<script lang="ts">
	let { bars = 6, rows = false }: { bars?: number; rows?: boolean } = $props();

	// Fixed pseudo-random widths/heights so the placeholder reads as a chart
	// instead of a grey block, without re-shuffling on every render.
	let sizes = $derived(Array.from({ length: bars }, (_, i) => 25 + ((i * 37) % 70)));
</script>

<div class="w-full" aria-hidden="true">
	{#if rows}
		<div class="flex animate-pulse flex-col gap-2.5">
			{#each sizes as size, i (i)}
				<div class="flex items-center gap-3">
					<div class="h-3 w-28 shrink-0 rounded bg-surface-200"></div>
					<div class="h-3 rounded bg-surface-200" style="width: {size}%"></div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex h-40 w-full animate-pulse items-end gap-1.5">
			{#each sizes as size, i (i)}
				<div class="flex-1 rounded-t bg-surface-200" style="height: {size}%"></div>
			{/each}
		</div>
	{/if}
</div>
