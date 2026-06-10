<script lang="ts">
	import Wave from '$lib/components/Wave.svelte';
	import { createPcmCapture, TranscriptionClient, type PcmCapture } from './transcription';

	let { show = $bindable(false), onSend }: { show: boolean; onSend: (transcript: string) => void } =
		$props();

	// Recording state. Audio is streamed live to the backend, which persists
	// the recording (source of truth) and relays it for transcription.
	let isRecording = $state(false);
	let isPaused = $state(false);
	let isTranscribing = $state(false);
	let hasRecordedContent = $state(false);
	let connectionFailed = $state(false);
	let transcriptionUnavailable = $state(false);
	let audioAmplitude = $state(0);

	let client: TranscriptionClient | null = null;
	let capture: PcmCapture | null = null;
	let audioStream: MediaStream | null = null;
	let animationFrameId: number | null = null;

	// Reset state when overlay opens
	$effect(() => {
		if (show) {
			isRecording = false;
			isPaused = false;
			isTranscribing = false;
			hasRecordedContent = false;
			connectionFailed = false;
			transcriptionUnavailable = false;
			audioAmplitude = 0;
		}
	});

	async function startRecording() {
		try {
			if (!capture) {
				// Without the socket nothing is recorded anywhere — don't
				// pretend to record if it fails.
				client = new TranscriptionClient();
				client.onUnavailable = () => (transcriptionUnavailable = true);
				await client.connect();

				audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
				capture = await createPcmCapture(audioStream, (chunk) => {
					client?.sendAudio(chunk);
					hasRecordedContent = true;
				});
			}

			capture.setActive(true);
			isRecording = true;
			isPaused = false;

			analyzeAmplitude();
		} catch (err) {
			console.error('Failed to start recording:', err);
			connectionFailed = true;
			cleanupRecording();
		}
	}

	function pauseRecording() {
		capture?.setActive(false);

		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		isRecording = false;
		isPaused = true;
		audioAmplitude = 0;
	}

	function analyzeAmplitude() {
		if (!capture || !isRecording) return;

		const dataArray = new Uint8Array(capture.analyser.frequencyBinCount);
		capture.analyser.getByteFrequencyData(dataArray);

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

		capture?.setActive(false);
		capture?.stop();
		capture = null;

		if (audioStream) {
			audioStream.getTracks().forEach((track) => track.stop());
			audioStream = null;
		}

		client?.close();
		client = null;

		isRecording = false;
		isPaused = false;
		audioAmplitude = 0;
	}

	function deleteRecording() {
		cleanupRecording();
		hasRecordedContent = false;
		show = false;
	}

	async function sendRecording() {
		if (!client || isTranscribing) return;

		if (isRecording) pauseRecording();
		isTranscribing = true;

		try {
			const transcript = await client.finish();
			onSend(transcript);
		} finally {
			cleanupRecording();
			isTranscribing = false;
			hasRecordedContent = false;
			show = false;
		}
	}

	function toggleRecordPause() {
		if (isRecording) {
			pauseRecording();
		} else {
			startRecording();
		}
	}
</script>

{#if show}
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
				{#if isTranscribing}
					<div class="flex items-center gap-2">
						<div
							class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						<span class="text-lg font-medium text-white">Transcribing...</span>
					</div>
				{:else if isRecording}
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
					{#if isTranscribing}
						Converting your recording to text
					{:else if isRecording}
						Speak clearly into your microphone
					{:else}
						Press record to start
					{/if}
				</p>
				{#if connectionFailed}
					<p class="text-sm text-red-400">Could not connect to the recording service.</p>
				{:else if transcriptionUnavailable}
					<p class="text-sm text-yellow-400">
						Transcription is currently unavailable. Your audio is still recorded.
					</p>
				{/if}
			</div>

			<!-- Control Buttons -->
			<div class="mt-4 flex items-center gap-4">
				<!-- Delete Button -->
				<button
					type="button"
					class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg transition-all hover:bg-gray-600 active:scale-95"
					onclick={deleteRecording}
					disabled={isTranscribing}
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
					disabled={isTranscribing || connectionFailed}
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
					disabled={!hasRecordedContent || isTranscribing}
					title="Send recording"
				>
					<i class="fas fa-paper-plane text-xl text-white"></i>
				</button>
			</div>
		</div>
	</div>
{/if}
