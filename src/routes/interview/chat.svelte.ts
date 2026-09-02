import { browser } from '$app/environment';
import {
	Auth,
	Interviews,
	type InterviewToken,
	type InterviewType,
	type OutgoingData,
	type OutgoingHistoryMessage,
	type OutgoingMessage,
	type ReceivedData
} from '$lib/api';
import { WS_UNAUTHORIZED, type Message } from '$lib/components/interview/types';

// Messages arriving over the interview WebSocket. `OutgoingData` is extended
// with the session identifiers the server includes on `data` frames.
type ServerMessage =
	| OutgoingMessage
	| OutgoingHistoryMessage
	| (OutgoingData & { interview_id?: string; project_id?: string });

// The server schema allows a list of images, but interview messages carry at
// most one. Over the WebSocket the image data is always a base64/URL string.
function toMessageImage(image: OutgoingMessage['image']): Message['image'] {
	const img = Array.isArray(image) ? image[0] : image;
	if (!img) return undefined;
	return { data: img.data as string, primer: img.primer ?? undefined };
}

/**
 * Parse interview ID from a JWT token
 */
export function parseInterviewIdFromToken(token: string): string | null {
	try {
		// Parse JWT payload (second part)
		const payload = token.split('.')[1];
		const decoded: InterviewToken = JSON.parse(atob(payload));
		return decoded.interview_id;
	} catch (e) {
		console.error('Failed to parse interview token', e);
		return null;
	}
}

// The credential is the httponly `interview_token` cookie, which the browser
// sends automatically on the WebSocket handshake. JavaScript cannot (and must
// not) read it, so this entry can only ever be a guess at whether the cookie is
// still there — the cookie is authoritative, and this mirrors its Max-Age
// (APP jwt_interview_token_expiration, 3 days) as a best effort.
//
// The two can still diverge (cleared cookies, a different browser), which is
// why divergence must be *recoverable* rather than merely unlikely: the
// backend closes an unauthenticated socket with WS_UNAUTHORIZED and we clear
// this entry and start over. Do not treat matching numbers here as a
// guarantee; that assumption is what previously stranded respondents in a
// reconnect loop.
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// How long a connection must survive before it counts as healthy. A backend
// that crashes part-way through a turn still opens the socket and replays the
// stored history first, so "the server sent something" is not evidence that
// reconnecting is working -- it is exactly what the failing case does on every
// attempt. Only time spent connected, or a turn the respondent completed,
// clears the retry budget.
const HEALTHY_CONNECTION_MS = 10_000;

// A ceiling that no amount of partial success can lift: more than this many
// connection attempts inside the window and we stop, however healthy any single
// one of them looked.
const RECONNECT_WINDOW_MS = 2 * 60 * 1000;
const MAX_CONNECTS_PER_WINDOW = 6;

// The server can also say outright that it is temporarily unable to run the
// interview -- the inference server still starting, a provider rate limit, an
// upstream timeout. That is worth waiting out rather than reconnecting into
// immediately, but not forever: after this many waits we stop and say so.
// One line covering every transient cause, because the respondent can act on
// none of them and the backend deliberately does not say which it was.
const TRANSIENT_FAILURE_TEXT = 'The interview service is busy. Trying again in a moment…';

const TRANSIENT_RETRY_MS = 30_000;
const MAX_TRANSIENT_RETRIES = 3;

// Opens that died before reaching HEALTHY_CONNECTION_MS. Two or more of them
// means the server is accepting us and then failing, which is a broken
// interview rather than a broken network -- worth saying so.
const SHORT_LIVED_OPENS_FOR_SERVICE_FAILURE = 2;

function sessionKey(projectId: string): string {
	return `interview_session:${projectId}`;
}

interface StoredSession {
	interview_id: string;
	project_id: string;
	expires_at: number;
}

export function saveInterviewSession(projectId: string, interviewId: string): void {
	if (!browser) return;
	try {
		const session: StoredSession = {
			interview_id: interviewId,
			project_id: projectId,
			expires_at: Date.now() + SESSION_TTL_MS
		};
		localStorage.setItem(sessionKey(projectId), JSON.stringify(session));
	} catch (e) {
		console.error('Failed to persist interview session', e);
	}
}

export function getStoredInterviewId(projectId: string): string | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(sessionKey(projectId));
		if (!raw) return null;
		const session: StoredSession = JSON.parse(raw);
		if (session.project_id !== projectId || session.expires_at <= Date.now()) {
			localStorage.removeItem(sessionKey(projectId));
			return null;
		}
		return session.interview_id;
	} catch (e) {
		console.error('Failed to read interview session', e);
		return null;
	}
}

export function clearInterviewSession(projectId: string): void {
	if (!browser) return;
	try {
		localStorage.removeItem(sessionKey(projectId));
	} catch (e) {
		console.error('Failed to clear interview session', e);
	}
}

export type CreateInterviewResult =
	{ ok: true; token: string } | { ok: false; paramsInvalid?: boolean };

/**
 * Create a new interview for the given project
 */
export async function createInterview(
	project_id: string,
	lang: string,
	interviewType: InterviewType | undefined,
	experimentID: string | undefined,
	externalParams: Record<string, unknown> | null | undefined,
	referer: string | null | undefined,
	pid: string | null | undefined
): Promise<CreateInterviewResult> {
	try {
		const { data, error, response } = await Interviews.createInterview({
			path: {
				project_id: project_id,
				lang: lang
			},
			body: {
				...(interviewType != null && { interview_type: interviewType }),
				experiment_id: experimentID,
				...(externalParams != null && { external_params: externalParams }),
				...(referer != null && { referer }),
				...(pid != null && { pid })
			}
		});
		if (error || !response?.ok) {
			// A 422 means the link's params don't satisfy the project's schema.
			// The body says no more than that on purpose — see the backend's
			// `validate_external_params`.
			if (response?.status === 422) {
				return { ok: false, paramsInvalid: true };
			}
			console.error('Failed to create interview');
			return { ok: false };
		}
		return data ? { ok: true, token: data } : { ok: false };
	} catch (e) {
		console.error('Error creating interview', e);
		return { ok: false };
	}
}

export class ChatClient {
	ws: WebSocket | null = null;
	messages = $state<Message[]>([]);
	isConnected = $state(false);
	isConnecting = $state(false);
	isInitialized = $state(false);
	inputEnabled = $state(false);
	forceTypingIndicator = $state(false);
	progress = $state(0);
	reconnectEnabled = $state(true);
	reconnectFailed = $state(false);
	isReconnecting = $state(false);
	/** The interview credential is gone and cannot be recovered. Reconnecting
	 *  is pointless; the respondent has to start a new interview. */
	sessionExpired = $state(false);
	/** The interview itself cannot run: the server reported a failure, or it
	 *  kept accepting connections and dying on them. Distinct from
	 *  `reconnectFailed`, which means we never got through at all -- here
	 *  retrying is known to be pointless, so we do not offer it. */
	serviceUnavailable = $state(false);

	// Show the typing indicator whenever we're waiting on the server. The chat
	// is turn-based: the last message being a user `sent` means a reply is
	// pending. `forceTypingIndicator` covers cases where the server explicitly
	// signals more is coming or where we run a mid-stream pause animation
	// (e.g. between an image primer and the image itself, or after a survey
	// submission that doesn't push a new message).
	showTypingIndicator = $derived.by(() => {
		if (!this.reconnectEnabled || this.reconnectFailed || this.isReconnecting) return false;
		if (this.sessionExpired || this.serviceUnavailable) return false;
		if (this.forceTypingIndicator) return true;
		const last = this.messages[this.messages.length - 1];
		if (!last || last.type !== 'sent') return false;
		if (last.survey_item) return false;
		return true;
	});
	reconnectAttempts = 0;
	maxReconnectAttempts = 5;
	reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Fires once a connection has stayed open long enough to be trusted. */
	private healthyTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Start times of recent connection attempts, for the rolling ceiling. */
	private connectTimestamps: number[] = [];
	/** Connections that opened and then closed before they were trusted. */
	private shortLivedOpens = 0;
	/** Waits already spent on a server that reported a transient failure. */
	private transientRetries = 0;

	// Context
	project_id: string;
	interview_id?: string;
	role: string;
	lang: string;
	is_test: boolean;
	is_synthetic: boolean;
	ws_path: string | null;

	messageQueue: ServerMessage[] = [];
	isProcessingQueue = false;

	constructor(
		project_id: string,
		role: string = 'respondent',
		lang: string = 'en',
		is_test: boolean = false,
		is_synthetic: boolean = false,
		ws_path: string | null = null
	) {
		this.project_id = project_id;
		this.role = role;
		this.lang = lang;
		this.is_test = is_test;
		this.is_synthetic = is_synthetic;
		this.ws_path = ws_path;
		if (role === 'interviewer') {
			this.inputEnabled = true;
		}
	}

	/**
	 * Initialize the chat client with an existing interview ID.
	 * The interview must already exist (either from cookie or newly created).
	 */
	initialize(interviewId: string) {
		this.interview_id = interviewId;
		console.log('Initializing chat with interview:', this.interview_id);
		this.connect();
	}

	connect() {
		if (!browser) return;
		if (this.isConnecting) return;

		const now = Date.now();
		this.connectTimestamps = this.connectTimestamps.filter((t) => now - t < RECONNECT_WINDOW_MS);
		if (this.connectTimestamps.length >= MAX_CONNECTS_PER_WINDOW) {
			this.giveUp();
			return;
		}
		this.connectTimestamps.push(now);

		this.isConnecting = true;

		const ws_url = this.getWsUrl();
		console.log(`Connecting to ${ws_url}`);

		try {
			this.ws = new WebSocket(ws_url);

			this.ws.onopen = () => {
				this.isConnected = true;
				this.isConnecting = false;
				this.isReconnecting = false;
				// NOTE: do not reset reconnectAttempts here — a socket that opens
				// but then closes shortly after (e.g. a backend that replays the
				// history and then fails on the model) would otherwise loop
				// forever with no backoff. Only surviving HEALTHY_CONNECTION_MS,
				// or completing a turn, clears the budget.
				this.markHealthyLater();
				this.inputEnabled = false; // Initial state often disabled until server speaks

				// Send initialized if needed or just handle open
				if (!this.isInitialized) {
					// Maybe add "Connected" system message?
				} else {
					this.inputEnabled = true;
				}

				// Original code calls handleOpen which adds system message "Connected"
				// But in Svelte we might just show connection status via UI
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.queueMessage(data);
				} catch (e) {
					console.error('Failed to parse message', e);
				}
			};

			this.ws.onclose = (event) => {
				this.isConnected = false;
				this.isConnecting = false;

				if (this.healthyTimeout) {
					// The connection never earned our trust: it opened and died
					// inside the health window. Enough of those in a row and the
					// server, not the network, is what is broken.
					clearTimeout(this.healthyTimeout);
					this.healthyTimeout = null;
					this.shortLivedOpens++;
				}

				// Fail fast on the one close we know is permanent. Every other
				// pre-open failure (server restarting, network blip) is exactly
				// what the backoff below exists for — see the note on
				// WS_UNAUTHORIZED in types.ts for why we can only distinguish
				// these two now that the backend closes rather than rejects.
				if (event.code === WS_UNAUTHORIZED) {
					this.handleSessionExpired();
					return;
				}

				if (this.reconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.isReconnecting = true;
					this.attemptReconnect();
				} else if (this.reconnectEnabled) {
					console.log('Max reconnects reached');
					this.giveUp();
				}
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error', error);
				this.isConnecting = false;
			};
		} catch (error) {
			console.error('Error creating WebSocket', error);
			this.isConnecting = false;
			this.attemptReconnect();
		}
	}

	getWsUrl() {
		let path;
		const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
		if (this.ws_path) {
			path = this.ws_path;
		} else {
			path = '/ws/ai?';
		}

		let host = window.location.host;
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			host = `${window.location.hostname}:8666`;
		}

		let ws_url = `${wsScheme}://${host}${path}`;

		if (this.isInitialized) {
			ws_url += (ws_url.includes('?') ? '&' : '?') + 'initialized=true';
		}

		return ws_url;
	}

	attemptReconnect() {
		if (!this.reconnectEnabled) return;

		this.reconnectAttempts++;
		const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts - 1));
		console.log(`Reconnecting in ${delay}ms...`);

		this.reconnectTimeout = setTimeout(() => {
			this.isInitialized = true; // Mark as initialized for reconnect
			this.connect();
		}, delay);
	}

	/** A connection that lasts this long is working; forgive the attempts that
	 *  led to it, so an interview spanning a flaky afternoon is not capped by
	 *  drops it already recovered from. */
	private markHealthyLater() {
		if (this.healthyTimeout) clearTimeout(this.healthyTimeout);
		this.healthyTimeout = setTimeout(() => {
			this.healthyTimeout = null;
			this.markHealthy();
		}, HEALTHY_CONNECTION_MS);
	}

	private markHealthy() {
		this.reconnectAttempts = 0;
		this.shortLivedOpens = 0;
		this.transientRetries = 0;
		this.connectTimestamps = [];
	}

	/** Stop retrying and say which of the two things went wrong. Repeated opens
	 *  that died young mean the server is failing the interview; anything else
	 *  looks like a connection we simply cannot establish. */
	private giveUp() {
		this.disableReconnect();
		this.isReconnecting = false;
		this.isConnecting = false;
		this.inputEnabled = false;
		this.forceTypingIndicator = false;

		if (this.shortLivedOpens >= SHORT_LIVED_OPENS_FOR_SERVICE_FAILURE) {
			this.serviceUnavailable = true;
		} else {
			this.reconnectFailed = true;
		}
	}

	/** The server told us it cannot run the interview *right now* — it is
	 *  starting up, rate limited, or waiting on a slow upstream. Reconnecting
	 *  straight into that only burns the retry budget on a failure we have been
	 *  told the shape of, so wait a while and try again on our own clock. */
	private handleTransientFailure() {
		// Cancels the ordinary backoff the socket's close is about to schedule
		// (or already has); this path owns the retry from here.
		this.disableReconnect();
		this.inputEnabled = false;
		this.forceTypingIndicator = false;

		if (this.transientRetries >= MAX_TRANSIENT_RETRIES) {
			this.isReconnecting = false;
			this.serviceUnavailable = true;
			return;
		}

		this.transientRetries++;
		// A give-up may have already fired on the socket close, before this
		// frame was processed; the server has since told us to wait, so take
		// that back.
		this.serviceUnavailable = false;
		this.reconnectFailed = false;
		this.isReconnecting = true;

		if (!this.messages.some((m) => m.type === 'system' && m.text === TRANSIENT_FAILURE_TEXT)) {
			this.messages.push({ type: 'system', text: TRANSIENT_FAILURE_TEXT });
		}

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectEnabled = true;
			this.reconnectAttempts = 0;
			this.shortLivedOpens = 0;
			this.connectTimestamps = [];
			this.isInitialized = true;
			this.connect();
		}, TRANSIENT_RETRY_MS);
	}

	/** The server told us the interview cannot run. Unlike a dropped
	 *  connection this is not worth retrying, so stop and say so. */
	private handleServiceFailure() {
		this.disableReconnect();
		this.isReconnecting = false;
		this.reconnectFailed = false;
		this.inputEnabled = false;
		this.forceTypingIndicator = false;
		this.serviceUnavailable = true;
	}

	manualReconnect() {
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		this.reconnectAttempts = 0;
		this.shortLivedOpens = 0;
		this.connectTimestamps = [];
		this.reconnectFailed = false;
		this.reconnectEnabled = true;
		this.isReconnecting = true;
		this.isInitialized = true;
		this.connect();
	}

	disableReconnect() {
		this.reconnectEnabled = false;
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		if (this.healthyTimeout) {
			clearTimeout(this.healthyTimeout);
			this.healthyTimeout = null;
		}
	}

	/** The backend closed us with WS_UNAUTHORIZED: the interview token is gone
	 *  or no longer valid, so this interview can never be resumed from this
	 *  browser. Drop the stale resume entry and surface it — `startOver()`
	 *  takes the respondent back through consent into a new interview. */
	private async handleSessionExpired() {
		this.disableReconnect();
		this.isReconnecting = false;
		this.reconnectFailed = false;
		this.inputEnabled = false;
		this.forceTypingIndicator = false;
		this.sessionExpired = true;

		// Clear the local entry first: it is the thing that decides whether the
		// next load tries to resume, and leaving it behind reproduces the loop.
		clearInterviewSession(this.project_id);

		const { error: exitError } = await Auth.exit();
		if (exitError) {
			console.error('Error during exit', exitError);
		}
	}

	/** Discard the expired session and start a fresh interview. */
	startOver() {
		clearInterviewSession(this.project_id);
		window.location.reload();
	}

	async sendFeedback(feedback: 'positive' | 'negative' | null, messageId: string | number) {
		// Update local state
		const msgIndex = this.messages.findIndex((m) => m.message_id === messageId);
		if (msgIndex !== -1) {
			// We need to mutate the message object. Since it's in a $state array, it should be reactive.
			// However, elements inside array might need to be accessed via state proxy.
			this.messages[msgIndex].feedback = feedback;
		}

		if (!this.project_id || !this.interview_id) return;

		// No ids in the body: the endpoint takes the interview and project from
		// the interview_token cookie, so feedback can only ever land on this
		// respondent's own transcript.
		const { error } = await Interviews.putFeedback({
			body: {
				message_id: Number(messageId),
				feedback: feedback
			}
		});
		if (error) {
			console.error('Error sending feedback', error);
		}
	}

	async sendImage(file: File) {
		if (!this.project_id || !this.interview_id) {
			console.error('Missing session info');
			return;
		}

		// Optimistic preview
		const reader = new FileReader();
		reader.onload = (e) => {
			this.messages.push({
				type: 'sent',
				image: { data: e.target?.result as string, alt: 'Uploaded image' },
				message_id: Date.now()
			});
		};
		reader.readAsDataURL(file);

		this.inputEnabled = false;

		const formData = new FormData();
		formData.append('file', file);
		formData.append('project_id', this.project_id);
		formData.append('interview_id', this.interview_id); // This might be set later via 'data' message

		try {
			const { data, error, response } = await Interviews.uploadInterviewImage({
				body: {
					project_id: this.project_id,
					interview_id: this.interview_id!,
					file: file
				}
			});

			if (error || !response?.ok) throw new Error('Upload failed');

			const result = data;

			if (result && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(
					JSON.stringify({
						type: 'image_uploaded',
						file: result.filename
					})
				);
			}
		} catch (error) {
			console.error('Error uploading image', error);
			this.messages.push({ type: 'system', text: 'Error uploading image.' });
			this.inputEnabled = true;
		}
	}

	disconnect() {
		this.disableReconnect();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.isConnected = false;
	}

	sendMessage(text: string, audioFilename: string | null = null) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		// A transcribed voice message references its server-side recording.
		const msg: ReceivedData = audioFilename
			? { type: 'audio', content: text, filename: audioFilename }
			: { type: 'message', content: text };
		this.ws.send(JSON.stringify(msg));

		// The respondent got far enough to answer, so this connection is doing
		// its job whatever its age -- forgive the retries that led here.
		this.markHealthy();

		// Optimistically add to UI
		this.messages.push({
			type: 'sent',
			text: text,
			message_id: Date.now() // temporary ID
		});

		if (this.role === 'respondent') {
			this.inputEnabled = false;
		}
	}

	sendSkip() {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(JSON.stringify({ type: 'message', content: '<|skipquestion|>' }));

		this.markHealthy();

		// Add to local UI
		this.messages.push({
			type: 'sent',
			text: '<|skipquestion|>',
			message_id: Date.now()
		});

		if (this.role === 'respondent') {
			this.inputEnabled = false;
		}
	}

	sendSurveyResponse(response: unknown, originalMessageId: string | number) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error('Cannot send survey response');
			return;
		}

		this.ws.send(
			JSON.stringify({
				type: 'message',
				content: response,
				responds_to: originalMessageId
			})
		);

		// A survey-only interview never calls `sendMessage`, so this is where its
		// completed turns register as progress.
		this.markHealthy();

		this.inputEnabled = false;
		// No new message is pushed here, but a server reply is pending — force
		// the indicator on until the server speaks.
		this.forceTypingIndicator = true;
	}

	// Message Queue Processing
	queueMessage(data: ServerMessage) {
		this.messageQueue.push(data);
		this.processQueue();
	}

	async processQueue() {
		if (this.isProcessingQueue) return;
		this.isProcessingQueue = true;

		try {
			while (this.messageQueue.length > 0) {
				const data = this.messageQueue.shift();
				if (data) await this.processSingleMessage(data);
			}
		} catch (e) {
			console.error('Error processing queue', e);
		} finally {
			this.isProcessingQueue = false;
		}
	}

	async processSingleMessage(data: ServerMessage) {
		// Server is speaking — drop any forced indicator from a prior send.
		this.forceTypingIndicator = false;

		switch (data.type) {
			case 'message':
				if (data.progress) this.progress = data.progress;
				if (data.image) {
					const image = toMessageImage(data.image);
					if (image?.primer) {
						await this.addMessage({
							type: 'received',
							text: image.primer,
							message_id: data.message_id
						});
					}
					await this.sleep(500);
					this.forceTypingIndicator = true;
					await this.sleep(1500);
					this.forceTypingIndicator = false;

					await this.addMessage({
						type: 'received',
						image,
						message_id: data.message_id
					});
				}

				if (data.survey_item) {
					if (data.content) {
						await this.addMessage({
							type: 'received',
							text: data.content,
							message_id: data.message_id
						});
					}
					await this.sleep(200);
					await this.addMessage({
						type: 'sent', // Survey is technically received content
						survey_item: data.survey_item,
						message_id: data.message_id
					});
					this.inputEnabled = false; // Input disabled while survey is active
				} else if (data.content) {
					await this.addMessage({
						type: 'received',
						text: data.content,
						message_id: data.message_id,
						can_answer: data.can_answer
					});
				}

				// Logic for enabling input
				if (data.survey_item) {
					// Handled above
				} else if (data.message_id != 1 && data.can_answer !== false) {
					this.inputEnabled = true;
				} else {
					// More server messages are coming — keep the indicator visible
					// even though the last message in the list is `received`.
					this.forceTypingIndicator = true;
				}
				break;

			case 'history':
				// History processing usually doesn't need delays
				if (data.role === 'user') {
					this.messages.push({
						type: 'sent',
						text: data.content,
						message_id: data.message_id
					});
				} else {
					if (data.image) {
						this.messages.push({
							type: 'received',
							image: toMessageImage(data.image),
							message_id: data.message_id
						});
					}
					if (data.content) {
						this.messages.push({
							type: 'received',
							text: data.content,
							message_id: data.message_id,
							feedback: data.feedback
						});
					}
				}
				break;

			case 'data':
				if (data.interview_id) this.interview_id = data.interview_id;
				if (data.project_id) this.project_id = data.project_id;
				if (data.progress) this.progress = data.progress;

				if (data.error) {
					if (data.error === 'InstanceInitializing') {
						// The backend classifies everything it expects to pass on
						// its own under this code — a warming inference server, a
						// rate limit, a slow upstream.
						this.handleTransientFailure();
					} else {
						// Everything else it reports has already been judged
						// unservable: a retired model, bad credentials, a bug on
						// our side. Reconnecting would only reproduce it.
						this.handleServiceFailure();
					}
				}

				if (data.content === '<|restartinterview|>') {
					this.disableReconnect();
					const { error: exitError } = await Auth.exit();
					if (exitError) {
						console.error('Error during exit', exitError);
					}
					clearInterviewSession(this.project_id);
					window.location.reload();
					return;
				}

				if (data.content === '<|endofinterview|>') {
					this.disableReconnect();

					const { error: exitError } = await Auth.exit();
					if (exitError) {
						console.error('Error during exit', exitError);
					}
					clearInterviewSession(this.project_id);
					// NOTE:
					// Type received to have styling applied, consider styling special
					// tokens for system as well

					this.messages.push({ type: 'received', text: '<|endofinterview|>' });
				}
				break;
		}
	}

	async addMessage(msg: Message) {
		this.messages.push(msg);
		// await tick(); // In component logic we might need tick, here we just push state
	}

	sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
