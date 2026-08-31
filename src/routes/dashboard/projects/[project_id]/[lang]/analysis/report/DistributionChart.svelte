<script lang="ts" module>
	/** One band of the chart: `key` places it, `label` names it on the axis. */
	export type Bar = { key: string; label: string; count: number } & Record<string, unknown>;
</script>

<script lang="ts">
	import { pooledColor } from '$lib/config/chartColors';
	import { format } from 'd3-format';
	import LazyMount from '$lib/components/LazyMount.svelte';
	import { BarChart, Tooltip, type ChartState } from 'layerchart';
	import ChartSkeleton from './ChartSkeleton.svelte';

	let {
		bars,
		languages,
		colorFor,
		total = 0,
		tooltipLabel = 'Answers',
		xLabel = null,
		yLabel = null,
		binned = false
	}: {
		bars: Bar[];
		// The respondents behind the bars, so a count tick can also say what
		// share of them it is. Zero leaves the axis as plain counts.
		total?: number;
		// One series per language when the page is splitting by language; the
		// bars then stack, so a bin shows both how tall it is and who filled it.
		// Empty or single means one series and one colour.
		languages: string[];
		colorFor: (language: string) => string;
		tooltipLabel?: string;
		/**
		 * Axis captions, drawn inside the plot the way the monitoring
		 * histograms draw theirs. Omitted axes keep their tighter padding.
		 */
		xLabel?: string | null;
		yLabel?: string | null;
		/**
		 * Whether the bands are histogram bins rather than discrete categories.
		 * A bin covers the span between two edges, so it is drawn between two
		 * ticks -- the same reading as the monitoring histograms -- instead of
		 * centred on one. Requires numeric `key`s that are the bins' lower
		 * edges, evenly spaced.
		 */
		binned?: boolean;
	} = $props();

	let stacked = $derived(languages.length > 1);

	let series = $derived(
		stacked
			? languages.map((language) => ({
					key: language,
					label: language.toUpperCase(),
					color: colorFor(language)
				}))
			: [{ key: 'count', label: tooltipLabel, color: pooledColor(languages, colorFor) }]
	);

	const AXIS_LABEL_PROPS = { class: 'text-[0.625rem] fill-gray-500' };

	// Room for the axis captions, on top of the space the tick labels need. The
	// count ticks carry a percentage too, so the y side is wide before any
	// caption is added.
	let padding = $derived({
		left: (total > 0 ? 60 : 32) + (yLabel ? 14 : 0),
		bottom: xLabel ? 36 : 22,
		right: 8,
		top: 8
	});

	// A bin's key is its lower edge, so the last bin has no band to carry its
	// upper edge. One empty band is appended to supply that closing tick. Being
	// zero is not enough to keep it from being drawn -- a bar of no height is
	// still a stroked path, and this one sits past the last edge, where it
	// reads as the axis running off the card -- so the CSS below drops it.
	// A single bin has no spacing to infer a width from and stays centred.
	let binStep = $derived(binned && bars.length > 1 ? Number(bars[1].key) - Number(bars[0].key) : 0);
	let shifted = $derived(binStep > 0);

	let bands = $derived.by((): Bar[] => {
		if (!shifted) return bars;
		const closing = Number(bars[bars.length - 1].key) + binStep;
		return [
			...bars,
			{
				key: String(closing),
				label: String(closing),
				count: 0,
				...Object.fromEntries(languages.map((language) => [language, 0]))
			}
		];
	});

	let chartContext = $state<ChartState | undefined>(undefined);
	let bandwidth = $derived(chartContext?.xScale?.bandwidth ? chartContext.xScale.bandwidth() : 0);
	// Left inset in, right inset out by the same amount: the bar keeps its width
	// and moves half a band to the right, so it spans edge-to-edge rather than
	// straddling its own tick.
	let barInsets = $derived(
		shifted ? { left: bandwidth / 2, right: -bandwidth / 2 } : { left: 0, right: 0 }
	);

	// Bin edges can be wide (a word-count histogram runs to three digits) and
	// there can be twenty of them, so only every nth label is drawn. Every bar
	// keeps its tick mark, and the tooltip carries the exact bin.
	const TICK_CHAR_WIDTH = 6.6; // approx. digit advance at text-xs
	const TICK_GAP = 10;
	let plotWidth = $state(0);

	// Shifted bands are labelled by their edge (the key), unshifted ones by the
	// band's own name; a range label like "10-15" would be meaningless sitting
	// on a single edge.
	let tickLabels = $derived(new Map(bands.map((b) => [b.key, shifted ? b.key : b.label])));

	let labelledKeys = $derived.by(() => {
		if (bands.length === 0 || plotWidth <= 0) return new Set(bands.map((b) => b.key));

		const widest = Math.max(...bands.map((b) => (tickLabels.get(b.key) ?? b.key).length));
		const needed = widest * TICK_CHAR_WIDTH + TICK_GAP;
		const stride = Math.max(1, Math.ceil(needed / (plotWidth / bands.length)));

		return new Set(bands.filter((_, i) => i % stride === 0).map((b) => b.key));
	});

	function formatTick(key: string) {
		return labelledKeys.has(key) ? (tickLabels.get(key) ?? key) : '';
	}

	const formatPercent = format('.0%');

	// Ticks are placed on round shares rather than on round counts: two cards
	// with different n are compared by share, and "10 · 9%" makes that
	// comparison arithmetic the reader has to do. The counts they land on are
	// whatever those shares come to.
	const PERCENT_STEPS = [0.05, 0.1, 0.2, 0.25, 0.5];
	const MAX_TICKS = 4;

	let maxCount = $derived(bands.length > 0 ? Math.max(...bands.map((b) => b.count)) : 0);

	let percentTicks = $derived.by(() => {
		if (total <= 0 || maxCount <= 0) return undefined;

		const maxShare = maxCount / total;
		const step = PERCENT_STEPS.find((s) => maxShare / s <= MAX_TICKS) ?? 1;

		const ticks = [0];
		// Only ticks the axis can actually show: the domain tops out at the
		// tallest bar, so anything past it would be dropped anyway.
		for (let share = step; share <= maxShare + 1e-9; share += step) ticks.push(share * total);
		return ticks;
	});

	// A count on its own answers "how many" but not "how much of the sample",
	// which is the question a reader comparing two cards with different n is
	// actually asking. Both go on the one axis rather than on two: a second
	// axis on a card this small costs more than it explains. Zero stays bare --
	// "0 · 0%" is noise on the baseline.
	function formatCount(value: number) {
		if (value === 0) return '0';
		if (total <= 0) return Number.isInteger(value) ? String(value) : '';
		// Without the percent ticks the axis picks its own values, and the
		// fractional ones between them are not counts worth labelling.
		if (!percentTicks && !Number.isInteger(value)) return '';
		return `${Math.round(value)} · ${formatPercent(value / total)}`;
	}
</script>

<!-- The caption used to sit under the chart box and now sits inside it, so the
     box takes over the height it had: the plot keeps the room it had before. -->
<div class="{xLabel ? 'h-48' : 'h-44'} w-full" bind:clientWidth={plotWidth}>
	<LazyMount class="h-full w-full">
		{#snippet placeholder()}
			<ChartSkeleton />
		{/snippet}
		{#snippet children(animate)}
			<!-- The reveal goes on the chart rather than the container, so it plays
			     when the chart appears rather than while the skeleton is still up. -->
			<div
				class="h-full w-full {animate ? 'chart-reveal' : ''} {shifted ? 'shifted-bar-chart' : ''}"
				style="--tooltip-offset: {bandwidth / 2}px"
			>
				<BarChart
					bind:context={chartContext}
					data={bands}
					x="key"
					{series}
					seriesLayout={stacked ? 'stack' : 'overlap'}
					bandPadding={shifted ? 0 : undefined}
					{padding}
					props={{
						xAxis: {
							format: formatTick,
							label: xLabel ?? undefined,
							labelProps: AXIS_LABEL_PROPS,
							classes: { tickLabel: 'text-[0.625rem]' }
						},
						yAxis: {
							format: formatCount,
							ticks: percentTicks,
							label: yLabel ?? undefined,
							labelProps: AXIS_LABEL_PROPS,
							classes: { tickLabel: 'text-[0.625rem]' }
						},
						// The grid picks its own tick values unless told otherwise, so
						// it has to be given the same ones or the lines land beside
						// the labels rather than on them.
						grid: { yTicks: percentTicks },
						bars: {
							rounded: 'edge',
							radius: 3,
							insets: barInsets,
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

<style>
	/* The closing band carries the last bin's upper edge on the axis and
	   nothing else: its bar is the one past the last edge, and every series
	   draws one. */
	:global(.shifted-bar-chart .lc-bars > :last-child) {
		display: none;
	}

	/* The bars moved half a band right; their hit areas have to follow, and the
	   closing band's -- now off the end of the data -- stops taking hits. */
	:global(.shifted-bar-chart .lc-tooltip-rects-g) {
		transform: translateX(var(--tooltip-offset));
	}

	:global(.shifted-bar-chart .lc-tooltip-rects-g > rect:last-child),
	:global(.shifted-bar-chart .lc-tooltip-rects-g > path:last-child) {
		pointer-events: none;
		opacity: 0;
	}

	:global(.shifted-bar-chart .lc-highlight-area) {
		transform: translateX(var(--tooltip-offset));
	}
</style>
