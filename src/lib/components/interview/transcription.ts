// Client for the backend /ws/transcribe endpoint. Streams raw PCM16 mic audio
// (which the backend persists as the source-of-truth recording and forwards to
// the OpenAI realtime transcription service) and accumulates transcript text.
// The final transcript is submitted through the normal interview message path.

// Backend + OpenAI expect 24 kHz mono PCM16.
const SAMPLE_RATE = 24_000;
// ~100ms of audio per binary frame.
const CHUNK_SAMPLES = 2_400;
// How long to wait for the final transcript after committing the buffer.
const FINISH_TIMEOUT_MS = 20_000;

function getTranscribeUrl(): string {
	const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
	let host = window.location.host;
	if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
		host = `${window.location.hostname}:8666`;
	}
	return `${wsScheme}://${host}/ws/transcribe`;
}

export class TranscriptionClient {
	private ws: WebSocket | null = null;
	private segments: string[] = [];
	private pendingFinish: { resolve: (transcript: string) => void; timer: number } | null = null;
	private bytesSinceCommit = 0;
	private lang: string;

	/** True when the backend reported the transcription service is down.
	 *  Audio sent over the socket is still recorded server-side. */
	unavailable = false;

	/** Invoked when the backend reports the transcription service is down. */
	onUnavailable: (() => void) | null = null;

	constructor(lang: string) {
		this.lang = lang;
	}

	/** Open the socket. Resolves once connected; rejects if the connection
	 *  fails (in which case nothing is being recorded). */
	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(getTranscribeUrl());
			ws.binaryType = 'arraybuffer';
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error('Failed to connect to transcription endpoint'));
			ws.onclose = () => {
				// A close while a finish() is pending means no more transcripts
				// are coming — resolve with what we have.
				this.resolveFinish();
			};
			ws.onmessage = (event) => this.handleMessage(event);
			this.ws = ws;
		});
	}

	/** Stream a PCM16 chunk. The backend records it unconditionally. */
	sendAudio(chunk: ArrayBuffer) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(chunk);
		this.bytesSinceCommit += chunk.byteLength;
	}

	/** Commit the audio buffer and wait for the final transcript. */
	finish(): Promise<string> {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN ||
			this.unavailable ||
			this.bytesSinceCommit === 0
		) {
			return Promise.resolve(this.transcript());
		}

		this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
		this.bytesSinceCommit = 0;

		return new Promise((resolve) => {
			const timer = window.setTimeout(() => {
				this.pendingFinish = null;
				resolve(this.transcript());
			}, FINISH_TIMEOUT_MS);
			this.pendingFinish = { resolve, timer };
		});
	}

	close() {
		this.resolveFinish();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private transcript(): string {
		return this.segments.join(' ').trim();
	}

	private resolveFinish() {
		if (!this.pendingFinish) return;
		clearTimeout(this.pendingFinish.timer);
		this.pendingFinish.resolve(this.transcript());
		this.pendingFinish = null;
	}

	private handleMessage(event: MessageEvent) {
		if (typeof event.data !== 'string') return;

		let data: any;
		try {
			data = JSON.parse(event.data);
		} catch {
			return;
		}

		switch (data.type) {
			case 'ready':
				// Backend connected upstream and handed us the model; configure
				// the transcription session (we own the handshake).
				this.ws?.send(
					JSON.stringify({
						type: 'session.update',
						session: {
							type: 'transcription',
							audio: {
								input: {
									format: { type: 'audio/pcm', rate: SAMPLE_RATE },
									transcription: {
										model: data.model,
										// OpenAI expects lowercase ISO-639-1 ('da', not 'DA' or 'da-DK')
										language: this.lang.slice(0, 2).toLowerCase()
									},
									turn_detection: null
								}
							}
						}
					})
				);
				break;

			case 'conversation.item.input_audio_transcription.completed':
				if (data.transcript) this.segments.push(data.transcript);
				this.resolveFinish();
				break;

			case 'error':
				if (data.error === 'transcription_unavailable') {
					this.unavailable = true;
					this.onUnavailable?.();
				} else {
					console.error('Transcription error', data.error);
				}
				// No transcript will arrive for a pending finish.
				this.resolveFinish();
				break;
		}
	}
}

const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buffer = new Int16Array(${CHUNK_SAMPLES});
		this.offset = 0;
	}
	process(inputs) {
		const input = inputs[0][0];
		if (!input) return true;
		for (let i = 0; i < input.length; i++) {
			const s = Math.max(-1, Math.min(1, input[i]));
			this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
			if (this.offset === this.buffer.length) {
				this.port.postMessage(this.buffer.buffer.slice(0));
				this.offset = 0;
			}
		}
		return true;
	}
}
registerProcessor('pcm-capture', PcmCapture);
`;

export interface PcmCapture {
	/** Analyser on the mic signal, for amplitude visualisation. */
	analyser: AnalyserNode;
	/** Gate chunk delivery (used for pause/resume). */
	setActive(active: boolean): void;
	stop(): Promise<void>;
}

/** Capture mic audio as 24 kHz mono PCM16 chunks via an AudioWorklet. */
export async function createPcmCapture(
	stream: MediaStream,
	onChunk: (chunk: ArrayBuffer) => void
): Promise<PcmCapture> {
	const context = new AudioContext({ sampleRate: SAMPLE_RATE });
	const workletUrl = URL.createObjectURL(
		new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
	);
	try {
		await context.audioWorklet.addModule(workletUrl);
	} finally {
		URL.revokeObjectURL(workletUrl);
	}

	const source = context.createMediaStreamSource(stream);
	const analyser = context.createAnalyser();
	analyser.fftSize = 256;
	analyser.smoothingTimeConstant = 0.8;
	source.connect(analyser);

	const worklet = new AudioWorkletNode(context, 'pcm-capture');
	source.connect(worklet);

	let active = false;
	worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
		if (active) onChunk(e.data);
	};

	return {
		analyser,
		setActive(value: boolean) {
			active = value;
		},
		async stop() {
			worklet.port.onmessage = null;
			worklet.disconnect();
			source.disconnect();
			await context.close();
		}
	};
}
