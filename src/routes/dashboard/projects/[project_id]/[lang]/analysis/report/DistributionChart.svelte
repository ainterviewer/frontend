<script lang="ts" module>
	/** One band of the chart: `key` places it, `label` names it on the axis. */
	export type Bar = { key: string; label: string; count: number } & Record<string, unknown>;
</script>

<script lang="ts">
	import LazyMount from '$lib/components/LazyMount.svelte';
	import { BarChart, Tooltip } from 'layerchart';
	import ChartSkeleton from './ChartSkeleton.svelte';

	let {
		bars,
		languages,
		colorFor,
		tooltipLabel = 'Answers',
		axisLabel = null
	}: {
		bars: Bar[];
		// One series per language when the cohort spans more than one; the bars
		// then stack, so a bin shows both how tall it is and who filled it.
		languages: string[];
		colorFor: (language: string) => string;
		tooltipLabel?: string;
		axisLabel?: string | null;
	} = $props();

	let stacked = $derived(languages.length > 1);

	let series = $derived(
		stacked
			? languages.map((language) => ({
					key: language,
					label: language.toUpperCase(),
					color: colorFor(language)
				}))
			: [{ key: 'count', label: tooltipLabel, color: colorFor(languages[0]) }]
	);

	// Bin edges can be wide (a word-count histogram runs to three digits) and
	// there can be twenty of them, so only every nth label is drawn. Every bar
	// keeps its tick mark, and the tooltip carries the exact edge.
	const TICK_CHAR_WIDTH = 6.6; // approx. digit advance at text-xs
	const TICK_GAP = 10;
	let plotWidth = $state(0);

	let labelledKeys = $derived.by(() => {
		if (bars.length === 0 || plotWidth <= 0) return new Set(bars.map((b) => b.key));

		const widest = Math.max(...bars.map((b) => b.label.length));
		const needed = widest * TICK_CHAR_WIDTH + TICK_GAP;
		const stride = Math.max(1, Math.ceil(needed / (plotWidth / bars.length)));

		return new Set(bars.filter((_, i) => i % stride === 0).map((b) => b.key));
	});

	let labels = $derived(new Map(bars.map((b) => [b.key, b.label])));

	function formatTick(key: string) {
		return labelledKeys.has(key) ? (labels.get(key) ?? key) : '';
	}
</script>

<div class="h-44 w-full" bind:clientWidth={plotWidth}>
	<LazyMount class="h-full w-full">
		{#snippet placeholder()}
			<ChartSkeleton />
		{/snippet}
		{#snippet children(animate)}
			<!-- The reveal goes on the chart rather than the container, so it plays
			     when the chart appears rather than while the skeleton is still up. -->
			<div class="h-full w-full {animate ? 'chart-reveal' : ''}">
				<BarChart
					data={bars}
					x="key"
					{series}
					seriesLayout={stacked ? 'stack' : 'overlap'}
					padding={{ left: 32, bottom: 22, right: 8, top: 8 }}
					props={{
						xAxis: { format: formatTick, classes: { tickLabel: 'text-[0.625rem]' } },
						yAxis: { format: 'metric', classes: { tickLabel: 'text-[0.625rem]' } },
						bars: {
							rounded: 'edge',
							radius: 3,
							motion: animate ? { type: 'tween', duration: 300 } : undefined
						}
					}}
				>
					{#snippet tooltip()}
						<Tooltip.Root>
							{#snippet children({ data }: { data: Bar })}
								<Tooltip.Header>{data.label}</Tooltip.Header>
								<Tooltip.List>
									{#if stacked}
										{#each languages as language (language)}
											{#if (data[language] as number) > 0}
												<Tooltip.Item
													label={language.toUpperCase()}
													value={data[language] as number}
												/>
											{/if}
										{/each}
									{/if}
									<Tooltip.Item label={tooltipLabel} value={data.count} />
								</Tooltip.List>
							{/snippet}
						</Tooltip.Root>
					{/snippet}
				</BarChart>
			</div>
		{/snippet}
	</LazyMount>
</div>

{#if axisLabel}
	<div class="mt-1 text-center text-[0.625rem] text-gray-500">{axisLabel}</div>
{/if}
