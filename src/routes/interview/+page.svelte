<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Auth } from '$lib/api/sdk.gen';
	import { ChatClient } from './chat.svelte';
	import GradientProgressBar from './components/GradientProgressBar.svelte';
	import InterviewMessage from './components/InterviewMessage.svelte';
	import Modal from './components/Modal.svelte';
	import TypingIndicator from './components/TypingIndicator.svelte';
	import Wave from '$lib/components/Wave.svelte';
	import type { TestType } from '$lib/api';

	interface PageData {
		project_id?: string;
		id?: string;
		lang: string;
		synthetic: boolean;
		test: boolean;
		testType?: TestType;
		experimentID?: string;
		image_upload?: any;
		help_title?: string;
		help_text?: string;
		exit_title?: string;
		exit_text?: string;
		exit_button?: string;
	}

	let { data }: { data: PageData } = $props();

	let projectId = $derived(data.project_id || 'default');
	let interviewId = $derived(data.id || '');
	let lang = $derived(data.lang);
	let testType = $derived(data.testType || '');
	let experimentID = $derived(data.experimentID);
	let imageUpload = $derived(data.image_upload);

	// Help/Exit data
	let helpTitle = $derived(data.help_title || 'Help');
	let helpText = $derived(data.help_text || 'Help text goes here.');
	let exitTitle = $derived(data.exit_title || 'Exit Interview');
	let exitText = $derived(data.exit_text || 'Are you sure you want to exit?');
	let exitButtonText = $derived(data.exit_button || 'End Interview');

	// Initialize chat client
	let chat = new ChatClient(
		data.project_id || 'default',
		'respondent',
		data.lang || 'en',
		data.test,
		data.synthetic
	);

	$effect(() => {
		chat.project_id = projectId;
		chat.lang = lang;
	});

	let messageInput = $state('');
	let messagesContainer: HTMLDivElement | undefined = $state();
	let textarea: HTMLTextAreaElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();

	let showHelp = $state(false);
	let showExit = $state(false);

	// Audio recording state
	let showRecordingOverlay = $state(false);
	let isRecording = $state(false);
	let isPaused = $state(false);
	let audioAmplitude = $state(0);
	let mediaRecorder: MediaRecorder | null = $state(null);
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let audioStream: MediaStream | null = null;
	let animationFrameId: number | null = null;
	let recordedChunks: Blob[] = [];
	let hasRecordedContent = $state(false);

	onMount(() => {
		chat.initialize();
		return () => chat.disconnect();
	});

	// Auto-scroll logic
	$effect(() => {
		const _ = [chat.messages.length, chat.showTypingIndicator];
		scrollToBottom();
	});

	async function scrollToBottom() {
		await tick();
		if (messagesContainer && messagesContainer.lastElementChild) {
			messagesContainer.lastElementChild.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = 'auto';
		target.style.height = target.scrollHeight + 'px';
		if (target.scrollHeight > 150) {
			target.style.overflowY = 'scroll';
		} else {
			target.style.overflowY = 'hidden';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			handleSubmit(e);
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!messageInput.trim()) return;
		chat.sendMessage(messageInput.trim());
		messageInput = '';
		if (textarea) {
			textarea.style.height = 'auto';
		}
	}

	function triggerCamera() {
		fileInput?.click();
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			chat.sendImage(target.files[0]);
			target.value = '';
		}
	}

	function exitInterview() {
		Auth.exit().then(({ response }) => {
			if (response.ok) {
				window.location.href = '/';
			}
		});
	}

	// Audio recording functions
	function openRecordingOverlay() {
		showRecordingOverlay = true;
		isRecording = false;
		isPaused = false;
		hasRecordedContent = false;
		recordedChunks = [];
		audioAmplitude = 0;
	}

	async function startRecording() {
		try {
			if (!audioStream) {
				audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

				// Set up audio analysis for amplitude
				audioContext = new AudioContext();
				const source = audioContext.createMediaStreamSource(audioStream);
				analyser = audioContext.createAnalyser();
				analyser.fftSize = 256;
				analyser.smoothingTimeConstant = 0.8;
				source.connect(analyser);

				// Set up media recorder
				mediaRecorder = new MediaRecorder(audioStream);

				mediaRecorder.ondataavailable = (e) => {
					if (e.data.size > 0) {
						recordedChunks.push(e.data);
						hasRecordedContent = true;
					}
				};
			}

			if (mediaRecorder && mediaRecorder.state === 'inactive') {
				mediaRecorder.start(100); // Collect data every 100ms for pause support
			} else if (mediaRecorder && mediaRecorder.state === 'paused') {
				mediaRecorder.resume();
			}

			isRecording = true;
			isPaused = false;

			// Start amplitude analysis loop
			analyzeAmplitude();
		} catch (err) {
			console.error('Failed to start recording:', err);
		}
	}

	function pauseRecording() {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.pause();
		}

		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		isRecording = false;
		isPaused = true;
		audioAmplitude = 0;
	}

	function analyzeAmplitude() {
		if (!analyser || !isRecording) return;

		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(dataArray);

		// Calculate average amplitude and normalize to 0-2 range for Wave component
		const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
		audioAmplitude = (avg / 128) * 2; // Scale for visible effect

		animationFrameId = requestAnimationFrame(analyzeAmplitude);
	}

	function cleanupRecording() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}

		if (audioStream) {
			audioStream.getTracks().forEach((track) => track.stop());
			audioStream = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}

		analyser = null;
		mediaRecorder = null;
		isRecording = false;
		isPaused = false;
		audioAmplitude = 0;
	}

	function deleteRecording() {
		cleanupRecording();
		recordedChunks = [];
		hasRecordedContent = false;
		showRecordingOverlay = false;
	}

	function sendRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}

		// Wait a moment for final data to be collected
		setTimeout(() => {
			if (recordedChunks.length > 0) {
				const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
				// TODO: Send audioBlob for transcription or handle as needed
				console.log('Sending recording:', audioBlob.size, 'bytes');
			}

			cleanupRecording();
			recordedChunks = [];
			hasRecordedContent = false;
			showRecordingOverlay = false;
		}, 100);
	}

	function toggleRecordPause() {
		if (isRecording) {
			pauseRecording();
		} else {
			startRecording();
		}
	}
</script>

<div class="flex h-dvh w-full flex-col bg-white pb-[env(safe-area-inset-bottom)]">
	<!-- Header -->
	<h1
		class="mx-auto mt-6 w-fit bg-[url('/svgs/underline-main.svg')] bg-bottom bg-center bg-no-repeat pb-12 text-center text-3xl font-bold text-dark"
	>
		AInterviewer
	</h1>

	<!-- Chat Area -->
	<div class="mb-8 flex flex-1 grow flex-col items-center overflow-y-auto">
		<div
			id="messages"
			bind:this={messagesContainer}
			class="w-full flex-1 overflow-y-auto px-2.5 sm:w-[90%] sm:max-w-[700px] sm:min-w-[500px] sm:px-0"
		>
			{#each chat.messages as msg, i (msg.message_id || i)}
				<div
					class={msg.type === 'system' ? 'mb-4 text-center text-sm text-gray-500 select-none' : ''}
				>
					{#if msg.type === 'system'}
						{msg.text}
					{:else}
						<InterviewMessage
							message={msg}
							{lang}
							isLast={i === chat.messages.length - 1}
							onFeedback={(f: any, id: any) => chat.sendFeedback(f, id)}
							onSkip={() => chat.sendSkip()}
							onSurveyAnswer={(ans: any, id: any) => chat.sendSurveyResponse(ans, id)}
						/>
					{/if}
				</div>
			{/each}

			{#if chat.showTypingIndicator}
				<TypingIndicator />
			{/if}

			<div class="h-4"></div>
		</div>
	</div>

	<!-- Reconnection Indicator -->
	{#if chat.isConnecting && !chat.isConnected && chat.messages.length > 0}
		<div
			class="fixed top-20 right-4 z-50 flex items-center rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-all"
		>
			<div
				class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
			></div>
			Reconnecting...
		</div>
	{/if}

	<!-- Input Area -->
	<div class="flex w-full flex-col items-center pb-2">
		<form
			onsubmit={handleSubmit}
			class="flex w-full flex-row items-center justify-center px-4 sm:px-0"
		>
			<!-- Controls Left -->
			<div class="mr-2 flex flex-col gap-[7px]">
				{#if imageUpload}
					<button
						type="button"
						class="flex h-[30px] w-[30px] items-center justify-center bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-100 disabled:opacity-50"
						onclick={triggerCamera}
						disabled={!chat.inputEnabled}
						title="Upload Image"
					>
						<i class="fa-regular fa-image text-lg text-gray-600"></i>
					</button>
					<input
						bind:this={fileInput}
						type="file"
						accept="image/*"
						capture={imageUpload === 'camera' ? 'environment' : undefined}
						class="hidden"
						onchange={handleFileSelect}
					/>
				{/if}
				<button
					type="button"
					class="flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
					onclick={() => (showHelp = true)}
					title="Show help"
				>
					<i class="fa-regular fa-circle-question text-lg text-gray-600"></i>
				</button>
				<button
					type="button"
					class="flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
					onclick={() => (showExit = true)}
					title="End interview"
				>
					<i class="fa-solid fa-door-open text-lg text-gray-600"></i>
				</button>
			</div>

			<!-- Textarea -->
			<textarea
				bind:this={textarea}
				bind:value={messageInput}
				disabled={!chat.inputEnabled}
				rows="1"
				placeholder="Message"
				class="
					min-h-[100px] w-full resize-none rounded border border-gray-300 p-2.5 text-[15px] shadow-sm transition-all
					focus:border-[#66afe9] focus:shadow-[0_0_5px_rgba(102,175,233,0.5)] focus:outline-none
					disabled:text-[#666666]
					sm:max-h-[8rem] sm:w-[40%] sm:max-w-[500px] sm:min-w-[350px]
				"
				oninput={handleInput}
				onkeydown={handleKeydown}
			></textarea>

			<!-- Send Button -->
			<div class="ml-1.5 flex flex-col">
				<button
					type="submit"
					disabled={!chat.inputEnabled || !messageInput.trim()}
					id="send-message"
					class="
						mt-[15px] cursor-pointer rounded bg-[#007bff] px-3 py-1.5 text-sm text-white transition-colors
						hover:bg-[#0056b3] active:bg-[#004085]
						disabled:cursor-not-allowed disabled:bg-[#cccccc] disabled:text-[#666666]
					"
					title="Send message (Ctrl+Enter)"
				>
					Send
				</button>
				<div class="mt-1 hidden text-center text-xs text-gray-400 sm:block">
					<span class="font-sans">ctrl</span>+<span class="font-bold">↵</span>
				</div>
				<div class="flex">
					<button
						type="button"
						class="m-auto flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
						onclick={openRecordingOverlay}
						disabled={!chat.inputEnabled}
						title="Record audio"
					>
						<i class="fas fa-microphone-lines text-lg text-gray-600"></i>
					</button>
				</div>
			</div>
		</form>

		<div class="mt-2 w-full max-w-[25rem] px-4 sm:px-0">
			<GradientProgressBar progress={chat.progress} />
		</div>
	</div>
</div>

<Modal show={showHelp} title={helpTitle} onClose={() => (showHelp = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
		{@html helpText}
	</div>
</Modal>

<Modal show={showExit} title={exitTitle} onClose={() => (showExit = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
		{@html exitText}
	</div>
	<div class="mt-6 flex justify-end">
		<button
			class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
			onclick={exitInterview}
		>
			{exitButtonText}
		</button>
	</div>
</Modal>

<!-- Recording Overlay -->
{#if showRecordingOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Audio recording"
	>
		<div class="flex flex-col items-center gap-6">
			<div class="h-64 w-64 sm:h-80 sm:w-80">
				<Wave
					amplitude={isRecording ? audioAmplitude : 0.5}
					animate={isRecording}
					speed={2}
					color="#196858"
				/>
			</div>

			<div class="flex flex-col items-center gap-2">
				{#if isRecording}
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 animate-pulse rounded-full bg-red-500"></span>
						<span class="text-lg font-medium text-white">Recording...</span>
					</div>
				{:else if isPaused && hasRecordedContent}
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 rounded-full bg-yellow-500"></span>
						<span class="text-lg font-medium text-white">Paused</span>
					</div>
				{:else}
					<span class="text-lg font-medium text-white">Ready to record</span>
				{/if}
				<p class="text-sm text-gray-300">
					{isRecording ? 'Speak clearly into your microphone' : 'Press record to start'}
				</p>
			</div>

			<!-- Control Buttons -->
			<div class="mt-4 flex items-center gap-4">
				<!-- Delete Button -->
				<button
					type="button"
					class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg transition-all hover:bg-gray-600 active:scale-95"
					onclick={deleteRecording}
					title="Delete recording"
				>
					<i class="fas fa-trash text-xl"></i>
				</button>

				<!-- Record/Pause Button -->
				<button
					type="button"
					class="flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
					class:bg-red-600={!isRecording}
					class:hover:bg-red-700={!isRecording}
					class:bg-yellow-600={isRecording}
					class:hover:bg-yellow-700={isRecording}
					onclick={toggleRecordPause}
					title={isRecording ? 'Pause recording' : 'Start recording'}
				>
					{#if isRecording}
						<i class="fas fa-pause text-3xl text-white"></i>
					{:else}
						<i class="fas fa-microphone text-3xl text-white"></i>
					{/if}
				</button>

				<!-- Send Button -->
				<button
					type="button"
					class="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
					class:bg-green-600={hasRecordedContent}
					class:hover:bg-green-700={hasRecordedContent}
					class:bg-gray-600={!hasRecordedContent}
					class:opacity-50={!hasRecordedContent}
					class:cursor-not-allowed={!hasRecordedContent}
					onclick={sendRecording}
					disabled={!hasRecordedContent}
					title="Send recording"
				>
					<i class="fas fa-paper-plane text-xl text-white"></i>
				</button>
			</div>
		</div>
	</div>
{/if}
