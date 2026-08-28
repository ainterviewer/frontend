<script lang="ts">
	import { ANSWER_STATE_COLORS } from '$lib/config/chartColors';
	import { format } from 'd3-format';

	let {
		asked,
		answered,
		skipped,
		compact = false
	}: {
		asked: number;
		answered: number;
		skipped: number;
		compact?: boolean;
	} = $props();

	const formatPercent = format('.0%');

	// Whoever saw the question and neither answered nor skipped it stopped here.
	// Clamped because the three numbers come from different message rows and a
	// half-written interview can leave them momentarily inconsistent.
	let dropped = $derived(Math.max(0, asked - answered - skipped));

	let segments = $derived([
		{ key: 'answered', label: 'Answered', count: answered, color: ANSWER_STATE_COLORS.answered },
		{ key: 'skipped', label: 'Skipped', count: skipped, color: ANSWER_STATE_COLORS.skipped },
		{ key: 'dropped', label: 'Dropped out', count: dropped, color: ANSWER_STATE_COLORS.dropped }
	]);

	let rate = $derived(asked > 0 ? answered / asked : 0);
</script>

<div class="flex items-center gap-2">
	<div
		class="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-surface-200"
		title={segments.map((s) => `${s.label}: ${s.count}`).join(' · ')}
	>
		{#each segments as segment (segment.key)}
			{#if segment.count > 0}
				<div
					class="h-full first:rounded-l-full last:rounded-r-full"
					style="width: {(segment.count / Math.max(1, asked)) *
						100}%; background-color: {segment.color}"
				></div>
			{/if}
		{/each}
	</div>
	<span class="shrink-0 text-xs text-gray-500 tabular-nums">
		{formatPercent(rate)}
		{#if !compact}
			<span class="text-gray-400">answered</span>
		{/if}
	</span>
</div>
