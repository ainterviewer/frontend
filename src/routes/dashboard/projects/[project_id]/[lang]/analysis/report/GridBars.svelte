<script lang="ts">
	import { format } from 'd3-format';

	import type { GridRowDistribution } from '$lib/api/types.gen';
	import { isDarkScaleColor, scaleColors } from '$lib/config/chartColors';

	/**
	 * A Likert grid's ratings: one 100%-stacked bar per row, a segment per
	 * point of the scale, so the rows can be compared down the card the way a
	 * battery is read.
	 *
	 * Not split by language. A grid is read row against row, and stacking each
	 * segment again by language would bury that; the language split stays on
	 * the cards with one bar per option.
	 */
	let { rows }: { rows: GridRowDistribution[] } = $props();

	const formatPercent = format('.0%');

	// The scale is the same on every row: the authored options, in order. A
	// rating that is none of them (an edited scale) is left off the bar.
	let scale = $derived(
		(rows[0]?.counts ?? []).filter((count) => !count.is_other).map((count) => count.label)
	);
	let colors = $derived(scaleColors(scale.length));

	function segments(row: GridRowDistribution) {
		const counts = row.counts.filter((count) => !count.is_other);
		const total = counts.reduce((sum, count) => sum + count.count, 0);
		return counts.map((count, index) => ({
			label: count.label,
			count: count.count,
			share: total > 0 ? count.count / total : 0,
			color: colors[index]
		}));
	}
</script>

<div class="flex flex-col gap-3">
	<!-- The legend: every point named, since the lightest steps are pale
	     against the card and colour alone would not tell them apart. -->
	<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600" aria-label="Scale">
		{#each scale as label, index (index)}
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style:background-color={colors[index]}></span>
				{label}
			</li>
		{/each}
	</ul>

	<div class="flex flex-col gap-2.5">
		{#each rows as row (row.id)}
			{@const parts = segments(row)}
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between gap-3 text-xs">
					<span class="min-w-0 text-gray-700">{row.label}</span>
					<span class="shrink-0 text-gray-500 tabular-nums">n = {row.n_answered}</span>
				</div>
				{#if row.n_answered > 0}
					<div class="flex h-5 w-full gap-[2px]" role="img" aria-label={row.label}>
						{#each parts as part, index (index)}
							{#if part.count > 0}
								<div
									class="flex min-w-0 items-center justify-center overflow-hidden text-[0.625rem] font-medium tabular-nums first:rounded-l last:rounded-r {isDarkScaleColor(
										part.color
									)
										? 'text-white'
										: 'text-gray-800'}"
									style:background-color={part.color}
									style:flex-grow={part.count}
									style:flex-basis="0"
									title="{row.label} · {part.label}: {formatPercent(part.share)} ({part.count})"
								>
									{#if part.share >= 0.1}{formatPercent(part.share)}{/if}
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="h-5 w-full rounded bg-surface-100"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>
