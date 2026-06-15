<script lang="ts">
	import { BarChart, Bars, Tooltip, type ChartContextValue } from 'layerchart';

	let {
		data,
		tooltipLabel = 'Interviews'
	}: {
		data: { value: number; count: number; label: string }[];
		tooltipLabel?: string;
	} = $props();

	let chartContext = $state<ChartContextValue | undefined>(undefined);
	let barBandwidth = $derived(
		chartContext?.xScale?.bandwidth ? chartContext.xScale.bandwidth() : 0
	);
	let barInsets = $derived({
		left: barBandwidth / 2,
		right: -barBandwidth / 2
	});

	let barsData = $derived(data.length <= 1 ? [] : data.slice(0, -1));
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
			xAxis: { classes: { tickLabel: 'text-xs' } },
			yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
			bars: {
				motion: { type: 'tween', duration: 300 },
				insets: barInsets
			}
		}}
	>
		{#snippet marks({ getBarsProps, series })}
			<Bars {...getBarsProps(series[0], 0)} data={barsData} />
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
