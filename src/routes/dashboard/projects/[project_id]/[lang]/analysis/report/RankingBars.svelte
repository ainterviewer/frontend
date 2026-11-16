<script lang="ts">
	import { format } from 'd3-format';

	import type { RankingOptionDistribution } from '$lib/api/types.gen';
	import { isDarkScaleColor, scaleColors, WRITE_IN_COLOR } from '$lib/config/chartColors';

	/**
	 * A ranking's answers: one 100%-stacked bar per option, a segment per rank,
	 * options ordered best ranked first, so the card reads top to bottom as the
	 * respondents' order did.
	 *
	 * Ranks run dark to light, first choice darkest: a rank has a direction,
	 * unlike a Likert scale (see `scaleColors`), and the eye should land on
	 * how often an option came first. In a top-N ranking a respondent who
	 * left an option out of their top N is the bar's grey tail.
	 *
	 * Not split by language, for the reason `GridBars` gives.
	 */
	let { options, answered }: { options: RankingOptionDistribution[]; answered: number } = $props();

	const formatPercent = format('.0%');
	const formatRank = format('.1f');

	let ranks = $derived(options[0]?.counts.length ?? 0);
	// Dark first: `scaleColors` runs light to dark.
	let colors = $derived([...scaleColors(ranks)].reverse());
	let topN = $derived(ranks < options.length);

	function ordinal(rank: number) {
		const tens = rank % 100;
		if (tens >= 11 && tens <= 13) return `${rank}th`;
		return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
	}

	function segments(option: RankingOptionDistribution) {
		const parts = option.counts.map((count, index) => ({
			label: ordinal(index + 1),
			count: count.count,
			color: colors[index]
		}));
		if (topN) {
			parts.push({
				label: 'Not ranked',
				count: Math.max(answered - option.n_ranked, 0),
				color: WRITE_IN_COLOR
			});
		}
		const total = parts.reduce((sum, part) => sum + part.count, 0);
		return parts.map((part) => ({ ...part, share: total > 0 ? part.count / total : 0 }));
	}
</script>

<div class="flex flex-col gap-3">
	<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600" aria-label="Ranks">
		{#each colors as color, index (index)}
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style:background-color={color}></span>
				{ordinal(index + 1)}
			</li>
		{/each}
		{#if topN}
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style:background-color={WRITE_IN_COLOR}
				></span>
				Not ranked
			</li>
		{/if}
	</ul>

	<div class="flex flex-col gap-2.5">
		{#each options as option (option.position)}
			{@const parts = segments(option)}
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between gap-3 text-xs">
					<span class="min-w-0 text-gray-700">{option.label}</span>
					<span class="shrink-0 text-gray-500 tabular-nums">
						{option.mean_rank != null ? `avg. rank ${formatRank(option.mean_rank)}` : 'not ranked'}
					</span>
				</div>
				{#if answered > 0}
					<div class="flex h-5 w-full gap-[2px]" role="img" aria-label={option.label}>
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
									title="{option.label} · {part.label}: {formatPercent(part.share)} ({part.count})"
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
