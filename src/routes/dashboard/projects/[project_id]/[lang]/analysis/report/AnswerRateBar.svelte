<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
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
	<!-- The breakdown carries its own swatches, so the row is readable without
	     going back to the legend at the top of the card it sits in. -->
	<HoverInfo asChild>
		{#snippet content()}
			<div class="flex flex-col gap-1">
				{#each segments as segment (segment.key)}
					<div class="flex items-center gap-2 whitespace-nowrap">
						<span class="h-2 w-2 shrink-0 rounded-full" style="background-color: {segment.color}"
						></span>
						<span>{segment.label}</span>
						<span class="ml-auto pl-2 tabular-nums">
							{segment.count}
							<span class="text-gray-400">
								· {formatPercent(asked > 0 ? segment.count / asked : 0)}
							</span>
						</span>
					</div>
				{/each}
			</div>
		{/snippet}
		{#snippet children({ props })}
			<div {...props} class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface-200">
				<!-- The segments grow together inside the track, so the track's own
				     grey stays at full width behind them. -->
				<div class="bar-grow flex h-full w-full gap-0.5">
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
			</div>
		{/snippet}
	</HoverInfo>
	<!-- The rate carries its own numerator: a row reading only "90%" leaves the
	     reader guessing whether it is 9 of 10 or 86 of 96, and the two are not
	     the same finding. Fixed width so the tracks in a list of rows all end at
	     the same x. -->
	<span class="shrink-0 text-xs text-gray-500 tabular-nums {compact ? 'w-20 text-right' : ''}">
		{formatPercent(rate)}
		<span class="text-gray-400"
			>({answered}){#if !compact}&nbsp;answered{/if}</span
		>
	</span>
</div>
