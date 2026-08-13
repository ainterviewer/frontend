<script lang="ts">
	let { bars = 14 }: { bars?: number } = $props();

	// Fixed pseudo-random heights so the placeholder reads as a chart instead of
	// a grey block, without re-shuffling on every render.
	let heights = $derived(Array.from({ length: bars }, (_, i) => 25 + ((i * 37) % 70)));
</script>

<div class="h-75 w-full" aria-hidden="true">
	<div class="flex h-full w-full animate-pulse items-end gap-1.5 pt-5 pr-5 pb-6 pl-10">
		{#each heights as height, i (i)}
			<div class="flex-1 rounded-t bg-surface-200" style="height: {height}%"></div>
		{/each}
	</div>
</div>
