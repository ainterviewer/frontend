<script lang="ts">
	import type { ItemDistribution } from '$lib/api/types.gen';
	import { format } from 'd3-format';
	import AnswerRateBar from './AnswerRateBar.svelte';
	import { reveal } from '$lib/utils/reveal';
	import ConditionNote from './ConditionNote.svelte';
	import { describeGates, questionNumber, summarizeConditions, type Gate } from './conditions';
	import DistributionChart, { type Bar } from './DistributionChart.svelte';
	import { badgeFor } from './itemTypes';
	import OptionBars from './OptionBars.svelte';
	import SampleDots from './SampleDots.svelte';

	let {
		item,
		languages,
		colorFor,
		gates = [],
		questionTitleFor = () => undefined
	}: {
		item: ItemDistribution;
		// The languages the chart splits by: empty or single means one series.
		languages: string[];
		colorFor: (language: string) => string;
		// The questions whose asking this one's answer decides. Inverted from
		// the whole guide by the page, since a question only ever records the
		// conditions it is itself gated by.
		gates?: Gate[];
		questionTitleFor?: (number: string) => string | undefined;
	} = $props();

	// A statement is not put to the respondent as a question at all, so it is
	// drawn as an aside rather than as a distribution.
	let isStatement = $derived(item.kind === 'statement');
	let badge = $derived(badgeFor(item));

	let number = $derived(questionNumber(item.section, item.main_question));

	// What had to hold for this question to be asked, and what its own answer
	// decides. Both are stated on the card, because a card whose cohort was
	// chosen by another answer cannot be compared with the one beside it.
	let condition = $derived(summarizeConditions(item.conditions));
	let gateText = $derived(gates.length > 0 ? describeGates(gates) : null);
	let notAsked = $derived(item.n_not_asked_by_condition ?? 0);

	// Everyone the condition could have applied to: those it let through plus
	// those it routed past. Not the interview total -- a question nested under
	// another condition was never on the path for some of them at all.
	let conditionCohort = $derived(item.n_asked + notAsked);

	const formatPercent = format('.0%');

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

	// Numeric values and text lengths are binned into ranges, so their bars span
	// between two edges; a temporal count is one day or one hour, which is a
	// band of its own.
	let binned = $derived(item.kind === 'numeric' || item.kind === 'text');

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
	{@attach reveal()}
	id="q-{item.section + 1}-{item.main_question + 1}"
	class="flex scroll-mt-24 flex-col gap-3 rounded-lg border p-5 target:ring-2 target:ring-amber-300 {isStatement
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
			<span class="mr-1.5 font-normal text-gray-400 tabular-nums">{number}</span>{item.question ||
				(isStatement ? 'Untitled statement' : 'Untitled question')}
		</h3>
		<span
			class="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase {badge.tone}"
		>
			<i class="{badge.icon} text-[0.6875rem]" aria-hidden="true"></i>
			{badge.label}
		</span>
	</div>

	{#if condition || gateText}
		<div class="flex flex-col gap-1">
			{#if condition}
				<ConditionNote
					icon="fa-solid fa-code-branch"
					text={condition.text}
					numbers={condition.refs.map((ref) => questionNumber(ref.section, ref.question))}
					titleFor={questionTitleFor}
					trailing={notAsked > 0
						? `${conditionCohort > 0 ? formatPercent(notAsked / conditionCohort) : '—'} (${notAsked}) skipped past it`
						: null}
				/>
			{/if}
			{#if gateText}
				<ConditionNote
					icon="fa-solid fa-arrow-turn-down"
					text={`This answer ${gateText}`}
					numbers={gates.map((gate) => questionNumber(gate.section, gate.question))}
					titleFor={questionTitleFor}
				/>
			{/if}
		</div>
	{/if}

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
			<DistributionChart
				{bars}
				{languages}
				{colorFor}
				total={item.n_answered}
				xLabel={axisLabel}
				{binned}
			/>
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
