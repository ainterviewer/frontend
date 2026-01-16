<script lang="ts">
	let { blob, duration }: { blob: Blob; duration: number } = $props();

	let audioUrl = $derived(URL.createObjectURL(blob));
	let isPlaying = $state(false);
	let audioElement: HTMLAudioElement | null = $state(null);

	// Format duration as mm:ss
	let formattedDuration = $derived(() => {
		const seconds = Math.floor(duration / 1000);
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	});

	function togglePlay() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play();
		}
		isPlaying = !isPlaying;
	}

	function handleEnded() {
		isPlaying = false;
	}
</script>

<div class="flex items-center gap-3 rounded-lg bg-white/20 p-2">
	<audio bind:this={audioElement} src={audioUrl} onended={handleEnded} class="hidden"></audio>

	<button
		type="button"
		class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/30 transition-colors hover:bg-white/40"
		onclick={togglePlay}
	>
		{#if isPlaying}
			<i class="fas fa-pause text-white"></i>
		{:else}
			<i class="fas fa-play text-white pl-0.5"></i>
		{/if}
	</button>

	<!-- Waveform visualization -->
	<div class="flex h-8 flex-1 items-center gap-[2px]">
		{#each Array(20) as _, i}
			<div
				class="w-1 rounded-full bg-white/60"
				style="height: {20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}px"
			></div>
		{/each}
	</div>

	<span class="shrink-0 text-sm text-white/80">{formattedDuration()}</span>
</div>
