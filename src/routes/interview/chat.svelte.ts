import { browser } from '$app/environment';
import { Interviews, type ReceivedData } from '$lib/api';

export type MessageType = 'sent' | 'received' | 'system';

export interface Message {
	id?: string | number;
	text?: string;
	type: MessageType;
	message_id?: number | string;
	feedback?: 'positive' | 'negative' | null;
	survey_item?: any;
	image?: { data: string; alt?: string; primer?: string };
	audio?: { blob: Blob; duration: number };
	can_answer?: boolean;
	user_image?: boolean;
	question_label?: string;
	section?: number | null;
	// For survey responses or other internal use
	options?: any;
	required?: boolean;
}

export class ChatClient {
	ws: WebSocket | null = null;
	messages = $state<Message[]>([]);
	isConnected = $state(false);
	isConnecting = $state(false);
	isInitialized = $state(false);
	inputEnabled = $state(false);
	showTypingIndicator = $state(false);
	progress = $state(0);
	reconnectEnabled = $state(true);
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

	async initialize() {
		if (!this.hasToken()) {
			await this.createInterview();
		}
		this.connect();
	}

	hasToken() {
		if (!browser) return false;
		return document.cookie.split(';').some((item) => item.trim().startsWith('interview_token='));
	}

	async createInterview() {
		try {
			const { error, response } = await Interviews.createInterview({
				path: {
					project_id: this.project_id,
					lang: this.lang
				},
				query: {
					synthetic: this.is_synthetic,
					test: this.is_test
				}
			});
			if (error || !response.ok) {
				console.error('Failed to create interview');
			}
		} catch (e) {
			console.error('Error creating interview', e);
		}
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
				this.reconnectAttempts = 0;
				this.inputEnabled = false; // Initial state often disabled until server speaks
				this.showTypingIndicator = false;

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

			this.ws.onclose = () => {
				this.isConnected = false;
				this.isConnecting = false;

				if (this.reconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.attemptReconnect();
				} else {
					console.log('Max reconnects reached or disabled');
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

		try {
			await Interviews.putFeedback({
				body: {
					message_id: Number(messageId),
					feedback: feedback,
					project_id: this.project_id,
					interview_id: this.interview_id
				}
			});
		} catch (e) {
			console.error('Error sending feedback', e);
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
		this.showTypingIndicator = true;

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
			this.showTypingIndicator = false;
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

	sendMessage(text: string) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const msg: ReceivedData = { type: 'message', content: text };
		this.ws.send(JSON.stringify(msg));

		// Optimistically add to UI
		this.messages.push({
			type: 'sent',
			text: text,
			message_id: Date.now() // temporary ID
		});

		if (this.role === 'respondent') {
			this.inputEnabled = false;
			this.showTypingIndicator = true;
		}
	}

	sendAudio(text: string, audioBlob: Blob, duration: number) {
		// TODO: Send audio to server for transcription
		// For now, just show in chat
		//
		const msg: ReceivedData = { type: 'audio', content: text, audio_content: audioBlob };
		this.ws.send(JSON.stringify(msg));

		// Add audio message to UI
		this.messages.push({
			type: 'sent',
			audio: { blob: audioBlob, duration },
			message_id: Date.now()
		});

		if (this.role === 'respondent') {
			this.inputEnabled = false;
			this.showTypingIndicator = true;
		}
	}

	sendSkip() {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(JSON.stringify({ type: 'message', content: '<|skipquestion|>' }));
		if (this.role === 'respondent') {
			this.inputEnabled = false;
			this.showTypingIndicator = true;
		}
	}

	sendSurveyResponse(response: any, originalMessageId: string | number) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error('Cannot send survey response');
			return;
		}

		this.ws.send(
			JSON.stringify({
				type: 'survey_response',
				content: response,
				responds_to: originalMessageId
			})
		);

		this.inputEnabled = false;
		this.showTypingIndicator = true;
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
		// Clear typing indicator before showing new message
		this.showTypingIndicator = false;

		switch (data.type) {
			case 'message':
				if (data.image) {
					if (data.image.primer) {
						await this.addMessage({
							type: 'received',
							text: data.image.primer,
							message_id: data.message_id
						});
					}
					await this.sleep(500);
					this.showTypingIndicator = true;
					await this.sleep(1500);
					this.showTypingIndicator = false;

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
						type: 'received', // Survey is technically received content
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
					this.showTypingIndicator = true;
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
						this.disableReconnect();
					} else {
						this.messages.push({ type: 'system', text: `Error: ${data.error}` });
					}
				}

				if (data.content === '<|endofinterview|>') {
					this.disableReconnect();
					// Handle exit logic (maybe a callback or event)
					this.messages.push({ type: 'system', text: 'Interview ended.' });
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
