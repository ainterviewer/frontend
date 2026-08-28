<script lang="ts">
	import type { ItemDistribution } from '$lib/api/types.gen';
	import AnswerRateBar from './AnswerRateBar.svelte';
	import DistributionChart, { type Bar } from './DistributionChart.svelte';
	import OptionBars from './OptionBars.svelte';
	import SampleDots from './SampleDots.svelte';

	let {
		item,
		languages,
		colorFor
	}: {
		item: ItemDistribution;
		languages: string[];
		colorFor: (language: string) => string;
	} = $props();

	// A question with no survey item was asked in free text; there is no item
	// type to name, so the badge says what the chart is instead.
	const ITEM_TYPE_LABELS: Record<string, string> = {
		radio: 'Single choice',
		checkbox: 'Multiple choice',
		likert: 'Likert',
		slider: 'Slider',
		number: 'Number',
		date: 'Date',
		datetime: 'Date & time',
		time: 'Time'
	};

	// `type` is the union's discriminant but carries a default on the backend,
	// so the generated type has it optional.
	let itemType = $derived(item.item?.type);
	// A statement is not put to the respondent as a question at all, so neither
	// the item type nor "free text" describes it.
	let isStatement = $derived(item.kind === 'statement');
	let typeLabel = $derived(
		isStatement ? 'Statement' : itemType ? (ITEM_TYPE_LABELS[itemType] ?? itemType) : 'Free text'
	);

	let unit = $derived(item.kind === 'text' ? 'words' : 'value');

	// A histogram bucket's `value` is its lower edge, which is unique within the
	// series and so doubles as the band key; a temporal count is keyed by its
	// own label (an ISO day, or an hour of the day). Each language's share is
	// spread onto its own key so the chart can stack on it.
	let bars = $derived.by((): Bar[] => {
		const source =
			item.kind === 'temporal'
				? item.counts.map((c) => ({
						key: c.label,
						label: c.label,
						count: c.count,
						by: c.by_language
					}))
				: item.buckets.map((b) => ({
						key: String(b.value),
						label: b.label,
						count: b.count,
						by: b.by_language
					}));

		return source.map(({ key, label, count, by }) => ({
			key,
			label,
			count,
			...Object.fromEntries(languages.map((language) => [language, by?.[language] ?? 0]))
		}));
	});

	// Below the backend's sample threshold the raw answers come back and are
	// drawn one dot each; above it there are only bins.
	let samples = $derived(item.samples ?? []);
	let showDots = $derived(samples.length > 0 && (item.kind === 'numeric' || item.kind === 'text'));

	let axisLabel = $derived(
		item.kind === 'text' ? 'Answer length (words)' : item.kind === 'numeric' ? 'Value' : null
	);

	let hasData = $derived(
		item.kind === 'categorical'
			? item.counts.length > 0
			: (showDots || bars.length > 0) && item.n_answered > 0
	);

	function round(value: number) {
		return Math.round(value * 100) / 100;
	}
</script>

<!-- A statement card is drawn as an aside -- dashed and unraised -- so a reader
     scanning for distributions skims past it, while a reader following the
     guide still finds it in place. -->
<div
	class="flex flex-col gap-3 rounded-lg border p-5 {isStatement
		? 'bg-surface-50 border-dashed border-gray-300'
		: 'border-gray-200 bg-white shadow-sm'}"
>
	<div class="flex items-start justify-between gap-3">
		<!-- `pre-line` so an authored line break in the question survives; runs of
		     spaces still collapse and the text still wraps. -->
		<h3
			class="text-sm font-medium text-pretty whitespace-pre-line {isStatement
				? 'text-gray-600'
				: 'text-gray-800'}"
		>
			<!-- Cards flow down one column and up the next, so where a card sits on
			     screen no longer says where its question sits in the guide. The
			     number says it. -->
			<span class="mr-1.5 font-normal text-gray-400 tabular-nums"
				>{item.section + 1}.{item.main_question + 1}</span
			>{item.question || (isStatement ? 'Untitled statement' : 'Untitled question')}
		</h3>
		<span
			class="shrink-0 rounded-full bg-surface-200 px-2 py-0.5 text-[0.625rem] font-medium tracking-wide text-gray-600 uppercase"
		>
			{typeLabel}
		</span>
	</div>

	{#if !isStatement}
		<AnswerRateBar asked={item.n_asked} answered={item.n_answered} skipped={item.n_skipped} />

		{#if !hasData}
			<div
				class="flex h-24 items-center justify-center rounded-md bg-surface-100 text-xs text-gray-500"
			>
				{item.n_asked === 0 ? 'Not reached by any interview yet' : 'No answers yet'}
			</div>
		{:else if item.kind === 'categorical'}
			<OptionBars
				counts={item.counts}
				total={item.n_answered}
				{languages}
				{colorFor}
				hiddenValues={item.n_other_hidden ?? 0}
				hiddenCount={item.n_other_hidden_count ?? 0}
			/>
		{:else if showDots}
			<SampleDots {samples} {languages} {colorFor} {unit} {axisLabel} />
		{:else}
			<DistributionChart {bars} {languages} {colorFor} {axisLabel} />
		{/if}

		<div class="flex flex-wrap gap-x-3 text-xs text-gray-500">
			<span>n = {item.n_answered}</span>
			{#if item.stats}
				<span>
					Min {round(item.stats.min)} · Median {round(item.stats.median)} · Max {round(
						item.stats.max
					)}
				</span>
			{/if}
		</div>
	{/if}
</div>
