<script lang="ts">
	let { src }: { src: string } = $props();

	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(NaN);

	let progress = $derived(
		Number.isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0
	);

	function formatTime(seconds: number): string {
		if (!Number.isFinite(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div
	class="inline-flex max-w-full items-center gap-2.5 rounded-full border border-gray-200 bg-white py-1 pr-3 pl-1 shadow-sm"
>
	<audio {src} preload="metadata" bind:paused bind:currentTime bind:duration class="hidden"></audio>

	<button
		type="button"
		class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-85"
		onclick={() => (paused = !paused)}
		aria-label={paused ? 'Play recording' : 'Pause recording'}
	>
		{#if paused}
			<i class="fa-solid fa-play pl-0.5 text-[10px]"></i>
		{:else}
			<i class="fa-solid fa-pause text-[10px]"></i>
		{/if}
	</button>

	<input
		type="range"
		class="seek w-28 sm:w-40"
		style:--progress="{progress}%"
		min="0"
		max={Number.isFinite(duration) ? duration : 0}
		step="0.01"
		bind:value={currentTime}
		aria-label="Seek"
	/>

	<span class="shrink-0 text-[11px] text-gray-500 tabular-nums">
		{formatTime(currentTime)} / {formatTime(duration)}
	</span>
</div>

<style>
	.seek {
		appearance: none;
		height: 4px;
		border-radius: 9999px;
		background: linear-gradient(
			to right,
			var(--color-primary) var(--progress),
			#e5e7eb var(--progress)
		);
		cursor: pointer;
	}

	.seek::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 2px solid white;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
	}

	.seek::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 2px solid white;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
	}
</style>
