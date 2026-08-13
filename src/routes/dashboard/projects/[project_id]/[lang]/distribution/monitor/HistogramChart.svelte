<script lang="ts">
	import { BarChart, Bars, Tooltip, type ChartState } from 'layerchart';

	let {
		data,
		tooltipLabel = 'Interviews'
	}: {
		data: { value: number; count: number; label: string }[];
		tooltipLabel?: string;
	} = $props();

	let chartContext = $state<ChartState | undefined>(undefined);
	let barBandwidth = $derived(
		chartContext?.xScale?.bandwidth ? chartContext.xScale.bandwidth() : 0
	);
	let barInsets = $derived({
		left: barBandwidth / 2,
		right: -barBandwidth / 2
	});

	let barsData = $derived(data.length <= 1 ? [] : data.slice(0, -1));

	// Every bin edge keeps its tick mark; only the labels are thinned, since bin
	// edges can be wide (e.g. 4-digit durations) and there are 21 of them.
	const TICK_CHAR_WIDTH = 6.6; // approx. digit advance at text-xs
	const TICK_GAP = 10;
	let labelledValues = $derived.by(() => {
		const plotWidth = chartContext?.width ?? 0;

		if (data.length === 0 || plotWidth <= 0) return new Set(data.map((d) => d.value));

		const widestLabel = Math.max(...data.map((d) => String(d.value).length));
		const needed = widestLabel * TICK_CHAR_WIDTH + TICK_GAP;
		const available = plotWidth / data.length;
		const stride = Math.max(1, Math.ceil(needed / available));

		return new Set(data.filter((_, i) => i % stride === 0).map((d) => d.value));
	});

	function formatTick(value: number) {
		return labelledValues.has(value) ? String(value) : '';
	}
</script>

<div class="shifted-bar-chart h-75 w-full" style="--tooltip-offset: {barBandwidth / 2}px">
	<BarChart
		bind:context={chartContext}
		{data}
		x="value"
		y="count"
		bandPadding={0}
		padding={{ left: 40, bottom: 24, right: 20, top: 20 }}
		props={{
			xAxis: { format: formatTick, classes: { tickLabel: 'text-xs' } },
			yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
			bars: {
				motion: { type: 'tween', duration: 300 },
				insets: barInsets
			}
		}}
	>
		{#snippet marks({ context })}
			{#each context.series.visibleSeries as s (s.key)}
				<Bars
					seriesKey={s.key}
					rounded="edge"
					radius={4}
					strokeWidth={1}
					motion={{ type: 'tween', duration: 300 }}
					insets={barInsets}
					data={barsData}
				/>
			{/each}
		{/snippet}
		{#snippet tooltip({ context })}
			<Tooltip.Root>
				{#snippet children({ data })}
					<Tooltip.Header>{data.label}</Tooltip.Header>
					<Tooltip.List>
						<Tooltip.Item label={tooltipLabel} value={context.y(data)} />
					</Tooltip.List>
				{/snippet}
			</Tooltip.Root>
		{/snippet}
	</BarChart>
</div>

<style>
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
