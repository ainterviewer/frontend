<script lang="ts">
	import Wave from '$lib/components/Wave.svelte';

	let {
		show = $bindable(false),
		onSend
	}: { show: boolean; onSend: (blob: Blob, duration: number) => void } = $props();

	// Audio recording state
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
	let recordingStartTime: number | null = null;
	let totalRecordingDuration = $state(0);

	// Reset state when overlay opens
	$effect(() => {
		if (show) {
			isRecording = false;
			isPaused = false;
			hasRecordedContent = false;
			recordedChunks = [];
			audioAmplitude = 0;
			recordingStartTime = null;
			totalRecordingDuration = 0;
		}
	});

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
			recordingStartTime = Date.now();

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

		// Accumulate recording duration
		if (recordingStartTime) {
			totalRecordingDuration += Date.now() - recordingStartTime;
			recordingStartTime = null;
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
		show = false;
	}

	function sendRecording() {
		// Calculate final duration (add any current recording segment)
		let finalDuration = totalRecordingDuration;
		if (recordingStartTime) {
			finalDuration += Date.now() - recordingStartTime;
		}

		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}

		// Wait a moment for final data to be collected
		setTimeout(() => {
			if (recordedChunks.length > 0) {
				const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
				onSend(audioBlob, finalDuration);
			}

			cleanupRecording();
			recordedChunks = [];
			hasRecordedContent = false;
			show = false;
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
