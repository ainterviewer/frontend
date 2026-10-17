<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { timeFormat } from 'd3-time-format';
	import { Tooltip } from 'layerchart';
	// Canvas rather than SVG: a stacked bar chart mounts a component per
	// segment, and at 90 daily bars the SVG nodes are most of the page's cost.
	import { AreaChart, BarChart } from 'layerchart/canvas';
	import { SvelteSet } from 'svelte/reactivity';

	import LazyMount from '$lib/components/LazyMount.svelte';

	export type TimeSeries = { key: string; label: string; color: string };
	export type TimeRow = { date: Date } & Record<string, number | Date>;

	let {
		rows,
		series,
		kind,
		label,
		period = 'day'
	}: {
		rows: TimeRow[];
		/** In stacking order, bottom first. Colors follow the entity, not the slot. */
		series: TimeSeries[];
		/** `area` for running totals, `bar` for per-day counts. */
		kind: 'area' | 'bar';
		/** What one unit is, for the tooltip total ("users", "interviews"). */
		label: string;
		/** What one row covers; a weekly row is dated by its Monday. */
		period?: 'day' | 'week';
	} = $props();

	const Y_TICKS = 4;
	const PADDING = { left: 36, bottom: 24, right: 12, top: 8 };
	// Canvas resolves any paint not passed explicitly through layerchart's CSS,
	// and the defaults (no fill on a line, a faint hover band) live in the SVG
	// components' stylesheets, which a canvas-only page never loads -- so they
	// come out black. Every paint is therefore spelled out here, in canvas prop
	// names (`fillOpacity`, not `fill-opacity`).
	const INK = '#1c2826';
	const HOVER_BAND = 'rgb(28 40 38 / 0.06)';
	const formatTick = timeFormat('%-d %b');
	const formatDay = timeFormat('%a %-d %b %Y');
	const formatWeek = timeFormat('Week of %-d %b %Y');

	// A band scale labels every bar unless told otherwise; keep about six,
	// evenly spaced, so a 90-day range does not print 90 dates.
	let barTicks = $derived.by(() => {
		const step = Math.max(1, Math.ceil(rows.length / 6));
		return rows.filter((_, i) => i % step === 0).map((row) => row.date);
	});

	// Hidden from this chart only, through its legend. The header's role
	// toggles decide which series reach the chart at all; this narrows within
	// them. Should it ever hide everything that arrives (the header took the
	// rest away), the chart shows them all rather than an empty plot.
	const hidden = new SvelteSet<string>();
	let shown = $derived.by(() => {
		const left = series.filter((s) => !hidden.has(s.key));
		return left.length > 0 ? left : series;
	});

	function toggle(key: string) {
		if (hidden.has(key)) {
			hidden.delete(key);
		} else if (shown.length > 1 || !shown.some((s) => s.key === key)) {
			// Never the last one: an empty chart reads as "nothing happened".
			hidden.add(key);
		}
	}

	// Double-click shows only this series, or everything again if it already
	// was the only one. The two clicks before it have toggled it off and on
	// again, so they cancel out and this sees the state from before them.
	function solo(key: string) {
		if (shown.length === 1 && shown[0].key === key) {
			hidden.clear();
			return;
		}
		hidden.clear();
		for (const s of series) if (s.key !== key) hidden.add(s.key);
	}

	let chartSeries = $derived(
		shown.map((s) => ({
			key: s.key,
			label: s.label,
			color: s.color,
			value: (row: TimeRow) => row[s.key] as number
		}))
	);

	function total(row: TimeRow): number {
		return shown.reduce((sum, s) => sum + ((row[s.key] as number) ?? 0), 0);
	}

	// The placeholder is this chart's own outline in grey: the stack's total as
	// a single path, on the axis the chart will draw (layerchart `nice()`s the
	// value axis with d3's default, and bands use `padding(BAND_PADDING)` on
	// both sides). One element instead of a component per bar, so it costs
	// nothing, and when the chart mounts only the colour changes.
	const BAND_PADDING = 0.2;
	let ghost = $derived.by(() => {
		const totals = rows.map(total);
		const y = scaleLinear()
			.domain([0, Math.max(1, ...totals)])
			.nice();
		const top = y.domain()[1];
		const n = totals.length;
		let path = '';
		let width = 1;
		if (kind === 'bar') {
			// In band units: band i starts at i + padding, and the bar fills the
			// rest of its step.
			const bar = 1 - BAND_PADDING;
			width = n + BAND_PADDING;
			path = totals
				.map((v, i) => (v > 0 ? `M${i + BAND_PADDING},${top - v}h${bar}V${top}h${-bar}Z` : ''))
				.join('');
		} else if (n > 1) {
			width = n - 1;
			path = `M0,${top}${totals.map((v, i) => `L${i},${top - v}`).join('')}L${n - 1},${top}Z`;
		}
		return { path, width, top, ticks: y.ticks(Y_TICKS) };
	});
</script>

{#snippet tooltip()}
	<Tooltip.Root>
		{#snippet children({ data }: { data: TimeRow })}
			<Tooltip.Header
				>{period === 'week' ? formatWeek(data.date) : formatDay(data.date)}</Tooltip.Header
			>
			<Tooltip.List>
				{#each [...shown].reverse() as s (s.key)}
					<Tooltip.Item label={s.label} value={data[s.key]} color={s.color} />
				{/each}
				{#if shown.length > 1}
					<Tooltip.Separator />
					<Tooltip.Item label="Total {label}" value={total(data)} />
				{/if}
			</Tooltip.List>
		{/snippet}
	</Tooltip.Root>
{/snippet}

{#if series.length > 1}
	<!-- A plain legend rather than layerchart's, so it never competes with the
	     axis for the bottom padding. Series are listed in stacking order; each
	     entry toggles its series, and a double-click shows it alone. -->
	<ul class="mb-1 -ml-1.5 flex flex-wrap gap-x-1 gap-y-1 text-xs">
		{#each series as s (s.key)}
			{@const on = shown.some((x) => x.key === s.key)}
			<li>
				<button
					type="button"
					class="flex items-center gap-1.5 rounded px-1.5 py-0.5 select-none hover:bg-gray-100
						{on ? 'text-gray-600' : 'text-gray-400'}"
					aria-pressed={on}
					title="Click to show or hide · double-click to show only {s.label}"
					onclick={() => toggle(s.key)}
					ondblclick={() => solo(s.key)}
				>
					<span
						class="inline-block h-2.5 w-2.5 rounded-sm"
						style="background: {on ? s.color : 'transparent'}; border: 1.5px solid {s.color}"
					></span>
					<span class={on ? '' : 'line-through'}>{s.label}</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<!-- Mounted through the shared queue, one chart per idle slot, so navigating
     here paints the page before six charts are built in a single frame. Keyed
     on the rows so new data (a range switch, a role toggle) goes back through
     the queue too: updating a mounted chart in place re-renders all of them
     in the same frame, which is the stall the queue exists to avoid. -->
{#key rows}
	<LazyMount class="h-56 w-full">
		{#snippet placeholder()}
			<div class="relative h-full w-full" aria-hidden="true">
				<!-- The plot area, inset by the chart's own padding. -->
				<div
					class="absolute"
					style="left: {PADDING.left}px; right: {PADDING.right}px; top: {PADDING.top}px; bottom: {PADDING.bottom}px"
				>
					{#each ghost.ticks as tick (tick)}
						<div
							class="absolute inset-x-0 border-t border-gray-100"
							style="bottom: {(tick / ghost.top) * 100}%"
						>
							<span
								class="absolute -translate-y-1/2 pr-2 text-right text-xs text-gray-300"
								style="right: 100%"
							>
								{tick}
							</span>
						</div>
					{/each}
					<svg
						class="absolute inset-0 h-full w-full animate-pulse text-gray-200"
						viewBox="0 0 {ghost.width} {ghost.top}"
						preserveAspectRatio="none"
					>
						<path d={ghost.path} fill="currentColor" />
					</svg>
				</div>
			</div>
		{/snippet}
		{#snippet children(animate)}
			<div class="h-full w-full {animate ? 'chart-reveal' : ''}">
				{#if kind === 'area'}
					<AreaChart
						data={rows}
						x="date"
						series={chartSeries}
						seriesLayout="stack"
						padding={PADDING}
						{tooltip}
						props={{
							xAxis: { format: formatTick, classes: { tickLabel: 'text-xs' } },
							yAxis: { format: 'integer', ticks: Y_TICKS, classes: { tickLabel: 'text-xs' } },
							grid: { yTicks: Y_TICKS },
							area: { fillOpacity: 0.85, line: { fill: 'none', strokeWidth: 2 } },
							highlight: { lines: { stroke: INK, strokeOpacity: 0.25, strokeWidth: 1 } }
						}}
					/>
				{:else}
					<BarChart
						data={rows}
						x="date"
						series={chartSeries}
						seriesLayout="stack"
						bandPadding={0.2}
						padding={PADDING}
						{tooltip}
						props={{
							xAxis: { format: formatTick, ticks: barTicks, classes: { tickLabel: 'text-xs' } },
							yAxis: { format: 'integer', ticks: Y_TICKS, classes: { tickLabel: 'text-xs' } },
							grid: { yTicks: Y_TICKS },
							// A surface-coloured stroke separates stacked segments, and keeps a
							// zero-height bar from drawing a dark tick on the baseline.
							bars: { radius: 2, stroke: '#ffffff', strokeWidth: 1 },
							highlight: { area: { fill: HOVER_BAND } }
						}}
					/>
				{/if}
			</div>
		{/snippet}
	</LazyMount>
{/key}
