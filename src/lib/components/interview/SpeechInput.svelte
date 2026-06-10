<script lang="ts">
	import { createPcmCapture, TranscriptionClient, type PcmCapture } from './transcription';

	let {
		onTranscript,
		onCancel
	}: {
		onTranscript: (transcript: string) => void;
		onCancel: () => void;
	} = $props();

	// Rolling amplitude history rendered as a scrolling bar indicator.
	const BAR_COUNT = 32;

	let bars = $state<number[]>(Array(BAR_COUNT).fill(0));
	let isTranscribing = $state(false);
	let failed = $state(false);
	let transcriptionUnavailable = $state(false);

	let client: TranscriptionClient | null = null;
	let capture: PcmCapture | null = null;
	let stream: MediaStream | null = null;
	let animationFrameId: number | null = null;

	// Recording starts as soon as the component mounts (the mic button click).
	$effect(() => {
		start();
		return cleanup;
	});

	async function start() {
		try {
			// Without the socket nothing is recorded anywhere — don't pretend
			// to record if it fails.
			client = new TranscriptionClient();
			client.onUnavailable = () => (transcriptionUnavailable = true);
			await client.connect();

			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			capture = await createPcmCapture(stream, (chunk) => client?.sendAudio(chunk));
			capture.setActive(true);
			analyzeAmplitude();
		} catch (err) {
			console.error('Failed to start recording:', err);
			failed = true;
			cleanup();
		}
	}

	function analyzeAmplitude() {
		if (!capture) return;
		const dataArray = new Uint8Array(capture.analyser.frequencyBinCount);
		capture.analyser.getByteFrequencyData(dataArray);
		const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
		bars = [...bars.slice(1), Math.min(1, avg / 128)];
		animationFrameId = requestAnimationFrame(analyzeAmplitude);
	}

	function cleanup() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		capture?.setActive(false);
		capture?.stop();
		capture = null;
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		client?.close();
		client = null;
	}

	async function send() {
		if (!client || isTranscribing) return;
		capture?.setActive(false);
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		isTranscribing = true;
		try {
			const transcript = await client.finish();
			onTranscript(transcript);
		} finally {
			cleanup();
		}
	}

	function cancel() {
		cleanup();
		onCancel();
	}
</script>

<div
	class="
		flex min-h-25 w-full items-center gap-2 rounded border border-gray-300 p-2.5 shadow-sm
		sm:max-h-32 sm:w-[40%] sm:max-w-125 sm:min-w-85
	"
>
	<!-- Cancel -->
	<button
		type="button"
		class="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400"
		onclick={cancel}
		disabled={isTranscribing}
		title="Discard recording"
	>
		<i class="fas fa-trash"></i>
	</button>

	{#if failed}
		<p class="flex-1 text-center text-sm text-red-500">Could not start recording.</p>
	{:else if isTranscribing}
		<div class="flex flex-1 items-center justify-center gap-2 text-gray-600">
			<div
				class="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
			></div>
			<span class="text-sm">Transcribing...</span>
		</div>
	{:else}
		<span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500"></span>
		<div class="flex h-10 flex-1 items-center justify-center gap-[2px]" aria-label="Recording">
			{#each bars as amplitude, i (i)}
				<div
					class="w-1 rounded-full bg-primary/70 transition-[height] duration-75"
					style="height: {4 + amplitude * 32}px"
				></div>
			{/each}
		</div>
		{#if transcriptionUnavailable}
			<span class="shrink-0 text-xs text-yellow-600">Transcription unavailable</span>
		{/if}
	{/if}

	<!-- Send -->
	<button
		type="button"
		class="flex size-8 shrink-0 items-center justify-center rounded-md text-white transition-colors disabled:cursor-not-allowed"
		class:bg-primary={!failed}
		class:hover:bg-dark={!failed}
		class:bg-gray-300={failed}
		onclick={send}
		disabled={isTranscribing || failed}
		title="Send recording"
	>
		<i class="fas fa-paper-plane"></i>
	</button>
</div>
