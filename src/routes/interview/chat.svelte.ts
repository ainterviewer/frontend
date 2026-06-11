import { browser } from '$app/environment';
import {
	Auth,
	Interviews,
	type InterviewToken,
	type InterviewType,
	type ReceivedData
} from '$lib/api';
import { type Message } from '$lib/components/interview/types';

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
// not) read it. We persist only the interview/project identifiers needed to
// decide whether to resume, with an expiry mirroring the token's lifetime
// (APP jwt_interview_token_expiration, 3 days) so a stale entry doesn't outlive
// the cookie.
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

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
	| { ok: true; token: string }
	| { ok: false; validationErrors?: Array<{ loc: string; msg: string }> };

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
		if (error || !response.ok) {
			// Try to extract validation errors from the response
			try {
				const body = error as any;
				if (body?.detail && Array.isArray(body.detail)) {
					const validationErrors = body.detail.map((d: any) => ({
						loc: Array.isArray(d.loc) ? d.loc.join('.') : String(d.loc),
						msg: d.msg
					}));
					return { ok: false, validationErrors };
				}
			} catch {
				// ignore parse errors
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

	// Show the typing indicator whenever we're waiting on the server. The chat
	// is turn-based: the last message being a user `sent` means a reply is
	// pending. `forceTypingIndicator` covers cases where the server explicitly
	// signals more is coming or where we run a mid-stream pause animation
	// (e.g. between an image primer and the image itself, or after a survey
	// submission that doesn't push a new message).
	showTypingIndicator = $derived.by(() => {
		if (!this.reconnectEnabled || this.reconnectFailed || this.isReconnecting) return false;
		if (this.forceTypingIndicator) return true;
		const last = this.messages[this.messages.length - 1];
		if (!last || last.type !== 'sent') return false;
		if (last.survey_item) return false;
		return true;
	});
	reconnectAttempts = 0;
	maxReconnectAttempts = 5;
	reconnectTimeout: any = null;

	// Context
	project_id: string;
	interview_id?: string;
	role: string;
	lang: string;
	is_test: boolean;
	is_synthetic: boolean;
	ws_path: string | null;

	messageQueue: any[] = [];
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
		this.isConnecting = true;

		const ws_url = this.getWsUrl();
		console.log(`Connecting to ${ws_url}`);

		try {
			this.ws = new WebSocket(ws_url);

			this.ws.onopen = () => {
				this.isConnected = true;
				this.isConnecting = false;
				// NOTE: do not reset reconnectAttempts here — a socket that opens
				// but then closes before any message arrives (e.g. backend data
				// handler crash) would otherwise loop forever with no backoff.
				// Attempts reset in onmessage once the server actually speaks.
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
					this.reconnectAttempts = 0;
					this.isReconnecting = false;
					this.queueMessage(data);
				} catch (e) {
					console.error('Failed to parse message', e);
				}
			};

			this.ws.onclose = () => {
				this.isConnected = false;
				this.isConnecting = false;

				if (this.reconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.isReconnecting = true;
					this.attemptReconnect();
				} else if (this.reconnectEnabled) {
					console.log('Max reconnects reached');
					this.isReconnecting = false;
					this.reconnectFailed = true;
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

	manualReconnect() {
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		this.reconnectAttempts = 0;
		this.reconnectFailed = false;
		this.reconnectEnabled = true;
		this.isReconnecting = true;
		this.isInitialized = true;
		this.connect();
	}

	disableReconnect() {
		this.reconnectEnabled = false;
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
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

		const { error } = await Interviews.putFeedback({
			body: {
				message_id: Number(messageId),
				feedback: feedback,
				project_id: this.project_id,
				interview_id: this.interview_id
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
			const { data, error, response } = await Interviews.uploadImage2({
				body: {
					project_id: this.project_id,
					interview_id: this.interview_id!,
					file: file
				}
			});

			if (error || !response.ok) throw new Error('Upload failed');

			const result: any = data;

			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
		this.reconnectEnabled = false;
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
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

	sendSurveyResponse(response: any, originalMessageId: string | number) {
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

		this.inputEnabled = false;
		// No new message is pushed here, but a server reply is pending — force
		// the indicator on until the server speaks.
		this.forceTypingIndicator = true;
	}

	// Message Queue Processing
	queueMessage(data: any) {
		this.messageQueue.push(data);
		this.processQueue();
	}

	async processQueue() {
		if (this.isProcessingQueue) return;
		this.isProcessingQueue = true;

		try {
			while (this.messageQueue.length > 0) {
				const data = this.messageQueue.shift();
				await this.processSingleMessage(data);
			}
		} catch (e) {
			console.error('Error processing queue', e);
		} finally {
			this.isProcessingQueue = false;
		}
	}

	async processSingleMessage(data: any) {
		// Server is speaking — drop any forced indicator from a prior send.
		this.forceTypingIndicator = false;

		switch (data.type) {
			case 'message':
				if (data.progress) this.progress = data.progress;
				if (data.image) {
					if (data.image.primer) {
						await this.addMessage({
							type: 'received',
							text: data.image.primer,
							message_id: data.message_id
						});
					}
					await this.sleep(500);
					this.forceTypingIndicator = true;
					await this.sleep(1500);
					this.forceTypingIndicator = false;

					await this.addMessage({
						type: 'received',
						image: data.image,
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
							image: data.image,
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
						this.messages.push({ type: 'system', text: 'System initializing. Please wait.' });
					} else if (data.error === 'InferenceError') {
						this.messages.push({
							type: 'system',
							text: `No server capacity. Please check back later.`
						});
					} else {
						this.messages.push({
							type: 'system',
							text: `An unexpected error has occured. Please try again later.`
						});
					}
					this.disableReconnect();
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
