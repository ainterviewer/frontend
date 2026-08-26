<script lang="ts">
	import { BarChart, Text, type ChartState } from 'layerchart';

	type DropoutBar = {
		key: string;
		label: string;
		count: number;
		tooltip: string;
		section: number | null;
		isProbe: boolean;
	};
	type DropoutBand = {
		section: number | null;
		label: string;
		description: string | null;
		span: number;
	};

	let {
		bars,
		bands
	}: {
		bars: DropoutBar[];
		bands: DropoutBand[];
	} = $props();

	// Must match the chart's `padding`, so the band strip is measured from the
	// same origin as the plot area.
	const PADDING = { left: 40, bottom: 24, right: 20, top: 8 };

	// Breathing room taken off both ends of every section rule, so a rule stops
	// short of its own outermost bars instead of running flush into them.
	const RULE_INSET = 4;

	// Vertical placement within the strip below the chart. The rule is held off
	// the top so it clears the axis' own tick labels, which the chart draws
	// inside its bottom padding.
	const RULE_TOP = 10;
	const LABEL_TOP = 16;

	let chartContext = $state<ChartState | undefined>(undefined);

	let labels = $derived(new Map(bars.map((bar) => [bar.key, bar.label])));
	let tooltips = $derived(new Map(bars.map((bar) => [bar.key, bar.tooltip])));

	// Section rules are measured off the chart's own x scale rather than by
	// dividing the plot area into equal shares. `bandPadding` applies outer
	// padding as well as inner, so the first bar does not start at the plot edge
	// and the step is not `width / bars.length` — sharing the width out evenly
	// left every rule slightly out of register with its bars, by an amount that
	// varied with how many bars the section spanned.
	let sectionRules = $derived.by(() => {
		const scale = chartContext?.xScale;
		if (!scale?.bandwidth) return [];

		const bandwidth = scale.bandwidth();
		const rules: { key: string; left: number; width: number; band: DropoutBand }[] = [];
		let index = 0;

		for (const band of bands) {
			const first = bars[index];
			const last = bars[index + band.span - 1];
			index += band.span;

			// The leading and trailing bands (never started, introduction, outro)
			// are deliberately unlabelled: they belong to no section.
			if (!band.label || !first || !last) continue;

			const left = scale(first.key);
			const right = scale(last.key) + bandwidth;
			rules.push({
				key: first.key,
				left: left + RULE_INSET,
				width: right - left - 2 * RULE_INSET,
				band
			});
		}

		return rules;
	});
</script>

{#snippet tickLabel({ props, index }: { props: Record<string, unknown>; index: number })}
	<!-- Probes are subordinate to the question they hang off, so they are set
	     smaller and lighter than the question ticks rather than competing with
	     them at the same weight.

	     The size is set here rather than through the axis' `classes.tickLabel`
	     so only one font-size class is ever present: two of them would resolve
	     by stylesheet order, which is not something to rely on. -->
	<Text
		{...props}
		class={[props.class, bars[index]?.isProbe ? 'text-[0.625rem] opacity-55' : 'text-xs']
			.filter(Boolean)
			.join(' ')}
	/>
{/snippet}

<div class="flex h-75 w-full flex-col">
	<div class="min-h-0 flex-1">
		<BarChart
			bind:context={chartContext}
			data={bars}
			x="key"
			y="count"
			series={[{ key: 'count', label: 'Dropouts', color: '#94a3b8' }]}
			padding={PADDING}
			props={{
				xAxis: {
					format: (key: string) => labels.get(key) ?? key,
					tickLabel
				},
				yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
				tooltip: {
					header: { format: (key: string) => tooltips.get(key) ?? key }
				},
				bars: { motion: { type: 'tween', duration: 300 } }
			}}
		/>
	</div>

	<!--
		The section bands are plain DOM rather than chart marks, so the section
		names stay selectable text and can be given a title attribute.
	-->
	<div
		class="relative h-11 shrink-0"
		style="margin-left: {PADDING.left}px; margin-right: {PADDING.right}px"
	>
		{#each sectionRules as rule (rule.key)}
			<div
				class="absolute border-t border-gray-300"
				style="left: {rule.left}px; width: {rule.width}px; top: {RULE_TOP}px"
			></div>
			<!-- The label is anchored to the rule's midpoint and centred with a
			     transform rather than by `text-align` on a box of the rule's width.
			     A single-question section is only one bar wide, so the label is
			     wider than its own box, and an overflowing centred line spills to
			     the right only — which read as a label that was off-centre. -->
			<div
				class="absolute -translate-x-1/2 text-sm whitespace-nowrap text-gray-500"
				style="left: {rule.left + rule.width / 2}px; top: {LABEL_TOP}px"
				title={rule.band.description ?? undefined}
			>
				{rule.band.label}
			</div>
		{/each}
	</div>
</div>
