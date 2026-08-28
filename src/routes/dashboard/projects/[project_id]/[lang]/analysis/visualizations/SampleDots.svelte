<script lang="ts">
	import type { AnswerSample } from '$lib/api/types.gen';

	let {
		samples,
		languages,
		colorFor,
		unit = 'words',
		axisLabel = null
	}: {
		samples: AnswerSample[];
		languages: string[];
		colorFor: (language: string) => string;
		// What a dot's position means, for its tooltip.
		unit?: string;
		// The same caption the binned chart carries, so the two ways of drawing
		// one measure name it identically.
		axisLabel?: string | null;
	} = $props();

	// A dot plot rather than a histogram, because this is the few-answers case.
	// Binning eleven answers into twenty buckets draws mostly empty space and
	// invents a shape the data does not have; one dot per answer draws exactly
	// what is there, and duplicates stack so ties stay countable.
	const DOT = 9; // px, including the gap between stacked dots
	const MAX_STACK = 7;

	let stacked = $derived(languages.length > 1);

	let min = $derived(Math.min(...samples.map((s) => s.value)));
	let max = $derived(Math.max(...samples.map((s) => s.value)));
	let span = $derived(max - min);

	let median = $derived.by(() => {
		const sorted = [...samples].map((s) => s.value).sort((a, b) => a - b);
		const middle = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
	});

	type Dot = { key: string; value: number; language: string; row: number };

	// Answers at the same value are stacked upward in language order, so a
	// column reads as a count and the colours within it stay comparable
	// between columns.
	let dots = $derived.by((): Dot[] => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const byValue = new Map<number, AnswerSample[]>();
		for (const sample of samples) {
			const existing = byValue.get(sample.value);
			if (existing) existing.push(sample);
			else byValue.set(sample.value, [sample]);
		}

		const out: Dot[] = [];
		for (const [value, group] of byValue) {
			const ordered = stacked
				? [...group].sort((a, b) => languages.indexOf(a.language) - languages.indexOf(b.language))
				: group;
			ordered.forEach((sample, row) => {
				out.push({ key: `${value}-${row}`, value, language: sample.language, row });
			});
		}
		return out;
	});

	let tallest = $derived(Math.max(1, ...dots.map((d) => d.row + 1)));
	let height = $derived(Math.min(tallest, MAX_STACK) * DOT + DOT);

	// A single distinct value has no span to lay out along, so the column goes
	// in the middle rather than collapsing onto the left edge.
	function offset(value: number) {
		return span === 0 ? 50 : ((value - min) / span) * 100;
	}
</script>

<div class="w-full">
	<!-- Inset so a dot centred on the first or last value is not clipped by the
	     container, and its axis label can sit under it. -->
	<div class="relative mx-3" style="height: {height}px">
		{#each dots as dot (dot.key)}
			{#if dot.row < MAX_STACK}
				<div
					class="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full"
					style="left: {offset(dot.value)}%; bottom: {dot.row * DOT}px; background-color: {colorFor(
						dot.language
					)}"
					title="{dot.value} {unit}{stacked ? ` · ${dot.language.toUpperCase()}` : ''}"
				></div>
			{/if}
		{/each}

		{#if tallest > MAX_STACK}
			<!-- The tallest column is taller than the plot; saying so beats
			     silently dropping the answers that did not fit. -->
			<div class="absolute top-0 right-0 text-[0.625rem] text-gray-400">
				stacks clipped at {MAX_STACK}
			</div>
		{/if}
	</div>

	<div class="relative mx-3 mt-1 border-t border-gray-200 pt-1">
		<div class="absolute left-0 -translate-x-1/2 text-[0.625rem] text-gray-500 tabular-nums">
			{min}
		</div>
		{#if span > 0}
			<div
				class="absolute -translate-x-1/2 text-[0.625rem] text-gray-400 tabular-nums"
				style="left: {offset(median)}%"
			>
				{median}
			</div>
			<div class="absolute right-0 translate-x-1/2 text-[0.625rem] text-gray-500 tabular-nums">
				{max}
			</div>
		{/if}
		<div class="h-3"></div>
	</div>

	{#if axisLabel}
		<div class="mt-1 text-center text-[0.625rem] text-gray-500">{axisLabel}</div>
	{/if}
</div>
