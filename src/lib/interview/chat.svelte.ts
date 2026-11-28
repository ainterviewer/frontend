import { tick } from 'svelte';

import { browser } from '$app/environment';
import {
	Auth,
	Interviews,
	type InterviewToken,
	type InterviewType,
	type OutgoingData,
	type OutgoingHistoryMessage,
	type OutgoingMessage,
	type ReceivedData,
	type ReportReason,
	type SecurityIntervention,
	type SecurityOverride
} from '$lib/api';
import {
	type Message,
	type SurveyItemUnion,
	WS_UNAUTHORIZED
} from '$lib/components/interview/types';
import { interviewImageUrl } from '$lib/guideImages';
import { getUiText } from '$lib/respondentText';
import { hasErrorCode } from '$lib/utils/errors';
import { backendWsUrl } from '$lib/utils/urls';

const SKIP_QUESTION = '<|skipquestion|>';

// Messages arriving over the interview WebSocket. `OutgoingData` is extended
// with the session identifiers the server includes on `data` frames.
type ServerMessage =
	| OutgoingMessage
	| OutgoingHistoryMessage
	| (OutgoingData & { interview_id?: string; project_id?: string })
	| RedirectFrame
	| WaitingFrame;

/** Sent the moment the interview's model cannot answer yet -- starting up,
 *  or busy -- with the seconds until the server tries again by itself, on
 *  this socket. The backend's own frame (`WaitingFrame` in its
 *  `app/schemas/interviews.py`), so it is not in the generated client. */
type WaitingFrame = { type: 'waiting'; reason: 'starting' | 'busy'; retry_after: number };

/** Sent after the end of a distributed interview whose project sends
 *  respondents on, e.g. to a survey panel's return link. The backend's own
 *  frame (`RedirectFrame` in its `app/schemas/interviews.py`), so it is not in
 *  the generated client. */
type RedirectFrame = { type: 'redirect'; url: string; delay_seconds: number };

// The server schema allows a list of images, but interview messages carry at
// most one. It comes by name; the browser loads it from the interview's images.
function toMessageImage(image: OutgoingMessage['image']): Message['image'] {
	const img = Array.isArray(image) ? image[0] : image;
	if (!img?.name) return undefined;
	return { src: interviewImageUrl(img.name), alt: img.alt, primer: img.primer ?? undefined };
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

// The server can also say it is waiting on the interview's model: an
// instance starting up, or a provider turning requests away for now. It says
// so the moment it knows (a `waiting` frame), keeps the socket open, and runs
// the turn again by itself, so there is nothing to reconnect for; the notice
// it puts in the chat comes down with the next message. When waiting will not
// help, or has gone on too long, the server reports an `error` instead.

// Opens that died before reaching HEALTHY_CONNECTION_MS. Two or more of them
// means the server is accepting us and then failing, which is a broken
// interview rather than a broken network -- worth saying so.
const SHORT_LIVED_OPENS_FOR_SERVICE_FAILURE = 2;

/** A message from the interview's security check, shown in a modal rather
 *  than in the chat. */
export type PendingIntervention = SecurityIntervention & { text: string };

export type CreateInterviewResult =
	| { ok: true; token: string }
	| { ok: false; paramsInvalid?: boolean; notDistributable?: boolean; shareInvalid?: boolean };

/**
 * Where a manual test starts when it is tried from part-way through the
 * guide: at a section's first question, or at a question. One of the two.
 */
export type StartPoint = { section_id: string } | { question_id: string };

/**
 * Create a new interview for the given project
 */
export async function createInterview(
	project_id: string,
	lang: string,
	interviewType: InterviewType | undefined,
	externalParams: Record<string, unknown> | null | undefined,
	referer: string | null | undefined,
	pid: string | null | undefined,
	start: StartPoint | null = null,
	/** A shared test link's token, in place of a collaborator's session. */
	shareToken: string | null = null
): Promise<CreateInterviewResult> {
	try {
		const { data, error, response } = await Interviews.createInterview({
			path: {
				project_id: project_id,
				lang: lang
			},
			body: {
				...(interviewType != null && { interview_type: interviewType }),
				...(externalParams != null && { external_params: externalParams }),
				...(referer != null && { referer }),
				...(pid != null && { pid }),
				...(start && 'section_id' in start && { start_section_id: start.section_id }),
				...(start && 'question_id' in start && { start_question_id: start.question_id }),
				...(shareToken != null && { share_token: shareToken })
			}
		});
		if (error || !response?.ok) {
			// `invalid_link_params`: the link's params don't satisfy the
			// project's schema. The body says no more than that on purpose — see
			// the backend's `validate_external_params`.
			if (hasErrorCode(error, 'invalid_link_params')) {
				return { ok: false, paramsInvalid: true };
			}
			// `not_distributable`: the published version uses a model or speech
			// this deployment allows in test interviews only.
			if (hasErrorCode(error, 'not_distributable')) {
				return { ok: false, notDistributable: true };
			}
			// `test_share_invalid`: the shared test link expired or was revoked
			// between landing on the page and starting.
			if (hasErrorCode(error, 'test_share_invalid')) {
				return { ok: false, shareInvalid: true };
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
	/** What the respondent is typing. Here rather than in the view, so an
	 *  answer lost in a dropped connection can be put back for them. */
	draft = $state('');
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
	/** A security intervention the respondent has not closed yet. While it is
	 *  set, the chat sits behind its modal. */
	securityIntervention = $state<PendingIntervention | null>(null);
	/** Timed messages the guide shows in a modal instead of the chat, oldest
	 *  first; the first is open until the respondent closes it. The interview
	 *  does not wait on them. */
	timedNotices = $state<string[]>([]);
	/** Where the respondent is about to be sent now the interview has ended,
	 *  and the seconds left before they are. */
	redirect = $state<{ url: string; remaining: number } | null>(null);
	private redirectTimer: ReturnType<typeof setInterval> | null = null;

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
	/** Whether an answer can go out now. `inputEnabled` says whose turn it is;
	 *  this also needs the socket open. A message sent while reconnecting would
	 *  be dropped, so the respondent's answer stays where it is until then. */
	canSend = $derived(this.inputEnabled && this.isConnected);

	reconnectAttempts = 0;
	maxReconnectAttempts = 5;
	reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Fires once a connection has stayed open long enough to be trusted. */
	private healthyTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Start times of recent connection attempts, for the rolling ceiling. */
	private connectTimestamps: number[] = [];
	/** Connections that opened and then closed before they were trusted. */
	private shortLivedOpens = 0;
	/** The notice in the chat while the server waits on the model. */
	private waitingNotice: string | null = null;

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
				// Closed until the server says it is the respondent's turn, on a
				// reconnect too: the server resends the message it waits on them to
				// answer (`resume_message` in the backend), and sends nothing while
				// it is replying -- which may be to an answer sent before the drop.
				this.inputEnabled = false;
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
		if (this.ws_path) {
			path = this.ws_path;
		} else {
			path = '/ws/ai?';
		}

		let ws_url = backendWsUrl(path);

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

	/** The server's model cannot answer yet, and the server will try again by
	 *  itself on this socket. Say why the reply is late -- in place of the
	 *  typing dots, which would promise a reply that is not coming yet --
	 *  until the next message arrives. A later frame replaces the notice. */
	private handleWaiting(frame: WaitingFrame) {
		this.inputEnabled = false;
		this.forceTypingIndicator = false;
		this.clearWaitingNotice();

		const connection = getUiText(this.lang).connection;
		const text =
			frame.reason === 'starting'
				? connection.starting(Math.max(1, Math.round(frame.retry_after / 60)))
				: connection.busy;
		this.waitingNotice = text;
		this.messages.push({ type: 'system', text });
	}

	/** Takes back the notice `handleWaiting` left in the chat. */
	private clearWaitingNotice() {
		if (this.waitingNotice === null) return;
		const notice = this.waitingNotice;
		const index = this.messages.findIndex((m) => m.type === 'system' && m.text === notice);
		if (index !== -1) this.messages.splice(index, 1);
		this.waitingNotice = null;
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
	 *  browser. Drop the dead cookie and surface it — `startOver()` takes the
	 *  respondent back through consent into a new interview. */
	private async handleSessionExpired() {
		this.disableReconnect();
		this.isReconnecting = false;
		this.reconnectFailed = false;
		this.inputEnabled = false;
		this.forceTypingIndicator = false;
		this.sessionExpired = true;

		const { error: exitError } = await Auth.exit();
		if (exitError) {
			console.error('Error during exit', exitError);
		}
	}

	/** Discard the expired session and start a fresh interview. */
	startOver() {
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

	/**
	 * Report an interviewer question as inappropriate, offensive or irrelevant.
	 *
	 * Returns whether the report was stored, so the dialog can keep the
	 * respondent on the form with what they wrote when it was not. Nothing is
	 * mutated locally on success: a report is not part of the transcript the
	 * respondent is reading, and the acknowledgement is the dialog's own.
	 *
	 * No ids in the body beyond the interview-scoped message id: the endpoint
	 * takes the interview and project from the interview_token cookie, exactly
	 * as `sendFeedback` does, so a report can only land on this respondent's
	 * own transcript.
	 */
	async sendReport(
		messageId: string | number,
		reason: ReportReason,
		comment: string | null
	): Promise<boolean> {
		if (!this.project_id || !this.interview_id) {
			console.error('Missing session info');
			return false;
		}

		const { error } = await Interviews.reportMessage({
			body: {
				message_id: Number(messageId),
				reason,
				comment
			}
		});

		if (error) {
			console.error('Error reporting question', error);
			return false;
		}

		return true;
	}

	async sendImage(file: File) {
		if (!this.project_id || !this.interview_id) {
			console.error('Missing session info');
			return;
		}
		// The upload is announced over the socket, so it would be lost unsent.
		if (!this.isConnected) return;

		// Optimistic preview
		const reader = new FileReader();
		reader.onload = (e) => {
			this.messages.push({
				type: 'sent',
				image: { src: e.target?.result as string, alt: 'Uploaded image' },
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
			this.messages.push({ type: 'system', text: getUiText(this.lang).chat.image_upload_failed });
			this.inputEnabled = true;
		}
	}

	/** Leave for the redirect now. `replace` so the back button does not
	 *  return the respondent into a finished interview. */
	continueRedirect() {
		if (!this.redirect) return;
		if (this.redirectTimer) clearInterval(this.redirectTimer);
		this.redirectTimer = null;
		window.location.replace(this.redirect.url);
	}

	private startRedirect({ url, delay_seconds }: RedirectFrame) {
		if (this.redirectTimer) clearInterval(this.redirectTimer);
		this.redirect = { url, remaining: Math.max(0, delay_seconds) };
		if (this.redirect.remaining === 0) return this.continueRedirect();
		this.redirectTimer = setInterval(() => {
			if (!this.redirect) return;
			this.redirect.remaining -= 1;
			if (this.redirect.remaining <= 0) this.continueRedirect();
		}, 1000);
	}

	disconnect() {
		if (this.redirectTimer) clearInterval(this.redirectTimer);
		this.redirectTimer = null;
		this.disableReconnect();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.isConnected = false;
	}

	/** Returns whether the message went out; it does not while reconnecting. */
	sendMessage(text: string, audioFilename: string | null = null): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

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
		return true;
	}

	sendSkip(): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
		this.ws.send(JSON.stringify({ type: 'message', content: SKIP_QUESTION }));

		this.markHealthy();

		// A skipped survey stays in the list, but no longer takes an answer.
		const last = this.messages[this.messages.length - 1];
		if (last?.survey_item && !last.answered) {
			last.answered = true;
			last.skipped = true;
		}

		// Add to local UI
		this.messages.push({
			type: 'sent',
			text: SKIP_QUESTION,
			message_id: Date.now()
		});

		if (this.role === 'respondent') {
			this.inputEnabled = false;
		}
		return true;
	}

	/** Answer an intervention the respondent may override. The interview waits
	 *  on this before it goes on. */
	respondToIntervention(choice: SecurityOverride) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.securityIntervention) return;

		const msg: ReceivedData = { type: 'message', content: choice };
		this.ws.send(JSON.stringify(msg));

		this.markHealthy();
		this.closeIntervention();
		// Whichever way it was answered, the server speaks next.
		this.forceTypingIndicator = true;
	}

	/** Close an intervention the respondent cannot override. The server has
	 *  already moved on without waiting for it. */
	dismissIntervention() {
		this.closeIntervention();
	}

	/** The modal goes, but a note of it stays in the chat, so what follows --
	 *  a question left early, the interview ending -- is not unexplained. */
	private closeIntervention() {
		if (!this.securityIntervention) return;
		this.messages.push({ type: 'system', text: this.securityIntervention.text });
		this.securityIntervention = null;
	}

	/** The survey question last replayed from the history, until its answer
	 *  arrives. */
	private replayedSurvey: { item: SurveyItemUnion; message_id: number } | null = null;

	/**
	 * A replayed answer. One to a survey question is drawn the way it was
	 * left: the item, read-only, with the answer in it -- or faded, followed
	 * by the skip, if it was skipped. Under the question's id, as live.
	 */
	private replayAnswer(data: OutgoingHistoryMessage) {
		const survey = this.replayedSurvey;
		this.replayedSurvey = null;
		const skipped = data.content === SKIP_QUESTION;
		if (survey) {
			this.messages.push({
				type: 'sent',
				survey_item: survey.item,
				message_id: survey.message_id,
				answered: true,
				...(skipped ? { skipped: true } : { answer: data.content })
			});
			if (!skipped) return;
		}
		this.messages.push({
			type: 'sent',
			text: data.content,
			message_id: data.message_id
		});
	}

	/** Returns whether the answer went out. While reconnecting it does not,
	 *  and the survey stays open for the respondent to submit again. */
	sendSurveyResponse(response: unknown, originalMessageId: string | number): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

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

		// The survey stays in the list with its answer shown, but it is no
		// longer what the view should be anchored on — see `surveyActive` in
		// `InterviewChat`.
		for (let i = this.messages.length - 1; i >= 0; i--) {
			const msg = this.messages[i];
			if (msg.survey_item && String(msg.message_id) === String(originalMessageId)) {
				msg.answered = true;
				break;
			}
		}

		this.inputEnabled = false;
		// No new message is pushed here, but a server reply is pending — force
		// the indicator on until the server speaks.
		this.forceTypingIndicator = true;
		return true;
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

		// The interview is running again, so it is no longer waiting on the
		// model. Only on what the interview says: the socket opening proves
		// nothing, as the server may answer it with another wait.
		if (data.type === 'message' || data.type === 'history') {
			this.clearWaitingNotice();
		}

		switch (data.type) {
			case 'message':
				if (await this.resumeQuestion(data)) break;

				if (data.security_intervention) {
					if (this.securityIntervention?.text === data.content) {
						// Still open: resent on a reconnect.
						break;
					}
					// Answered, but the answer was lost in a dropped connection: the
					// modal opens again, so the note its closing left goes.
					const last = this.messages[this.messages.length - 1];
					if (last?.type === 'system' && last.text === data.content) this.messages.pop();
					this.securityIntervention = { ...data.security_intervention, text: data.content };
					this.inputEnabled = false;
					// Unless the respondent has to answer first, the server goes on
					// straight away -- the next question, or the end of the interview.
					this.forceTypingIndicator = !data.security_intervention.respondent_override;
					break;
				}

				// Never part of the conversation; what it precedes follows.
				if (data.as_modal) {
					if (data.content) this.timedNotices.push(data.content);
					this.forceTypingIndicator = true;
					break;
				}

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
							message_id: data.message_id,
							survey_prompt: true,
							can_skip: data.can_skip
						});
					}
					await this.sleep(200);
					await this.addMessage({
						type: 'sent', // Survey is technically received content
						survey_item: data.survey_item,
						message_id: data.message_id,
						can_skip: data.can_skip
					});
					this.inputEnabled = false; // Input disabled while survey is active
				} else if (data.content) {
					await this.addMessage({
						type: 'received',
						text: data.content,
						message_id: data.message_id,
						can_answer: data.can_answer,
						can_skip: data.can_skip
					});
				}

				// Logic for enabling input
				if (data.survey_item) {
					// Handled above
				} else if (data.can_answer !== false) {
					// Decided by the message, not by its position: the introduction
					// is sent with `can_answer: false`, and an interview without
					// one -- or a test started part-way -- opens on a question.
					this.inputEnabled = true;
				} else {
					// More server messages are coming — keep the indicator visible
					// even though the last message in the list is `received`.
					this.forceTypingIndicator = true;
				}
				break;

			case 'history':
				// History processing usually doesn't need delays
				if (data.security_intervention) {
					// Already answered or closed; one still waiting on the
					// respondent is replayed as a live message instead.
					this.messages.push({ type: 'system', text: data.content });
				} else if (data.role === 'user') {
					this.replayAnswer(data);
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
					// Drawn with the answer that follows it, as it was left.
					this.replayedSurvey = data.survey_item
						? { item: data.survey_item, message_id: data.message_id }
						: null;
				}
				break;

			case 'redirect':
				// After the end frame, which has already cleared the session.
				this.startRedirect(data);
				break;

			case 'waiting':
				this.handleWaiting(data);
				break;

			case 'data':
				if (data.interview_id) this.interview_id = data.interview_id;
				if (data.project_id) this.project_id = data.project_id;
				if (data.progress) this.progress = data.progress;

				if (data.error) {
					// Whatever it was, the server has judged it unservable: a
					// model that is not coming, a wait that went on too long, a
					// retired model, a bug on our side. Waits it handles itself,
					// with `waiting` frames, so reconnecting would only repeat it.
					this.clearWaitingNotice();
					this.handleServiceFailure();
				}

				if (data.content === '<|restartinterview|>') {
					this.disableReconnect();
					const { error: exitError } = await Auth.exit();
					if (exitError) {
						console.error('Error during exit', exitError);
					}
					window.location.reload();
					return;
				}

				if (data.content === '<|endofinterview|>') {
					this.disableReconnect();

					const { error: exitError } = await Auth.exit();
					if (exitError) {
						console.error('Error during exit', exitError);
					}
					// NOTE:
					// Type received to have styling applied, consider styling special
					// tokens for system as well

					this.messages.push({ type: 'received', text: '<|endofinterview|>' });
				}
				break;
		}
	}

	/**
	 * The message the interview waits on, resent by the server on a reconnect,
	 * when the chat already shows it. Not drawn again; whatever the respondent
	 * sent after it never arrived, so it is taken back -- typed text into the
	 * field, a survey reopened -- and the turn is theirs again. Returns false for
	 * a message the chat does not have, which is drawn as usual.
	 */
	private async resumeQuestion(data: OutgoingMessage): Promise<boolean> {
		if (data.message_id == null || data.security_intervention) return false;
		const id = String(data.message_id);
		const ownsId = (m: Message) => m.type !== 'system' && String(m.message_id) === id;

		const start = this.messages.findIndex(
			(m) => ownsId(m) && (m.type === 'received' || m.survey_item)
		);
		if (start === -1) return false;
		// The question's own entries: its text, image and survey item.
		let end = start;
		while (end < this.messages.length && ownsId(this.messages[end])) end++;

		const after = this.messages.slice(end);
		const lost = after.filter((m) => m.type === 'sent');
		const notes = after.filter((m) => m.type === 'system');

		const typed = lost.findLast((m) => m.text && m.text !== SKIP_QUESTION)?.text;
		if (typed && !this.draft.trim()) this.draft = typed;

		const surveyIndex = this.messages.findIndex((m, i) => i >= start && i < end && m.survey_item);
		const survey = surveyIndex === -1 ? null : this.messages[surveyIndex];
		if (survey?.answered && survey.survey_item) {
			// The survey keeps its submitted state in its own component, so it is
			// drawn afresh: gone for a render, then back unanswered.
			const item = survey.survey_item;
			this.messages.splice(surveyIndex);
			await tick();
			this.messages.push(
				{ type: 'sent', survey_item: item, message_id: data.message_id, can_skip: data.can_skip },
				...notes
			);
		} else {
			this.messages.splice(end, Infinity, ...notes);
		}

		// A survey takes its answer in the survey, not the field.
		this.inputEnabled = !data.survey_item && data.can_answer !== false;
		return true;
	}

	async addMessage(msg: Message) {
		this.messages.push(msg);
		// await tick(); // In component logic we might need tick, here we just push state
	}

	sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
