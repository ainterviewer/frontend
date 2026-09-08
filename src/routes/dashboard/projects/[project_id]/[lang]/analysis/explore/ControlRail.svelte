<script lang="ts">
	import type {
		EmbeddingKind,
		GroupKind,
		InterviewGuide,
		InterviewStatus,
		LanguageCode,
		Projection,
		SurveyFacet
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { Switch } from 'bits-ui';
	import { SvelteSet } from 'svelte/reactivity';
	import { format } from 'd3-format';
	import type { Snippet } from 'svelte';
	import {
		DEFAULT_CENTER_BY_LANGUAGE,
		DEFAULT_CENTER_BY_QUESTION,
		DEFAULT_MIN_CLUSTER_SIZE,
		DEFAULT_MIN_DIST,
		DEFAULT_N_NEIGHBORS,
		DEFAULT_PROJECTION,
		KINDS,
		MIN_CLUSTER_SIZE_RANGE,
		MIN_DIST_RANGE,
		N_NEIGHBORS_RANGE,
		PROJECTIONS,
		defaultFilters,
		hasQuestion,
		hasSurveyValue,
		setSurveyRange,
		surveyValueToken,
		toggleSurveyValue,
		toggleLanguage,
		toggleQuestion,
		toggleSection
	} from './explore';
	import type { KeywordScope, SurveyRanges, SurveySelection } from './explore';

	let {
		open = $bindable(),
		groupMode,
		modes,
		kind,
		projection = $bindable(),
		nNeighbors = $bindable(),
		minDist = $bindable(),
		minClusterSize = $bindable(),
		maxClusterSize,
		centerByQuestion = $bindable(),
		centerByLanguage = $bindable(),
		interviewStatus = $bindable(),
		filterLanguages = $bindable(),
		includeSynthetic = $bindable(),
		filterQuestions = $bindable(),
		keyword = $bindable(),
		keywordScope = $bindable(),
		surveyValues = $bindable(),
		surveyRanges = $bindable(),
		guide,
		surveyFacets,
		listing,
		visibleLanguages = $bindable(),
		languages,
		multilingual,
		offDefault,
		ongroupmode,
		onkind
	}: {
		open: boolean;
		groupMode: GroupKind;
		/** The grouping modes on offer, which is not every mode the API has. */
		modes: { value: GroupKind; label: string; hint: string }[];
		kind: EmbeddingKind;
		projection: Projection;
		nNeighbors: number;
		minDist: number;
		minClusterSize: number;
		/** Read off the run on screen, so the top of the slider means something. */
		maxClusterSize: number;
		centerByQuestion: boolean;
		centerByLanguage: boolean;
		interviewStatus: InterviewStatus | null;
		/**
		 * Languages the corpus is narrowed to before it is projected, empty for
		 * all of them. Costs a refetch, and moves every point on the map: the
		 * projection is fitted to what is left.
		 */
		filterLanguages: LanguageCode[];
		includeSynthetic: boolean;
		/**
		 * Places in the interview guide the corpus is narrowed to, as
		 * `[section, main_question]` pairs, empty for all of them. Like the
		 * language filter and unlike `visibleLanguages`, this narrows the corpus
		 * before it is projected: it costs a refetch and moves every point.
		 */
		filterQuestions: [number, number][];
		/**
		 * The guide the question filter offers, or null while it is loading or if
		 * it failed. Null simply hides the control — a filter is not worth an
		 * error banner over a working map.
		 */
		/**
		 * The literal filter, empty for none. Lives in the toolbar rather than
		 * here — it is typed while reading, not set once — but the rail's reset
		 * has to clear it, or "back to default" would leave the corpus narrowed.
		 */
		keyword: string;
		/** Reset only, for the same reason: clearing the words but leaving the
		 * toggle on "Questions" would show a scope that is filtering nothing. */
		keywordScope: KeywordScope;
		/**
		 * Which survey answers the interviews behind the chunks must hold, keyed
		 * by `section,main_question`. A cohort filter: it selects respondents by
		 * what they answered and keeps everything they said, so it narrows the
		 * corpus the same way the language filter does — a refetch, and every
		 * point moves.
		 */
		surveyValues: SurveySelection;
		/** The same, for the items answered with a number or a date. */
		surveyRanges: SurveyRanges;
		guide: InterviewGuide | null;
		/**
		 * The survey items to offer, with the answers respondents actually gave
		 * and how many gave each. Null while it loads, and empty for a project
		 * whose guide asks nothing closed — both hide the control, because a
		 * picker with nothing in it is a promise of something to find.
		 */
		surveyFacets: SurveyFacet[] | null;
		/**
		 * Whether the list is showing rather than the map.
		 *
		 * The Colour and Layout groups describe a scatter — how it is projected,
		 * how tightly it packs, what the dots are coloured by — and a list has
		 * none of that. They are hidden rather than disabled: a control that
		 * cannot do anything is still something to read past, and the corpus
		 * filters are the whole rail in this view.
		 */
		listing: boolean;
		/**
		 * Languages currently on show, empty for all of them. Costs nothing and
		 * moves nothing — the same projection with the rest faded out — which is
		 * why it sits under Colour rather than beside the filters.
		 */
		visibleLanguages: LanguageCode[];
		/**
		 * The languages on offer: the project's own localizations at first paint,
		 * replaced by what the corpus actually holds once the status call lands.
		 * Never the plotted points, which the filter below would narrow out from
		 * under itself. `count` is null while it is the former — the project
		 * knows its languages, not how much of each is embedded.
		 */
		languages: { code: LanguageCode; name: string; count: number | null }[];
		/**
		 * Whether the corpus holds more than one language. Centring on language,
		 * filtering by it and hiding one are all real choices only where there is
		 * more than one; on a single-language corpus centring subtracts one mean
		 * from everything and the other two can only ever say "all of it".
		 */
		multilingual: boolean;
		/** How many settings are off default, counted by `offDefaultCount`. */
		offDefault: number;
		/** Both of these invalidate a selection, so the page owns them. */
		ongroupmode: (next: GroupKind) => void;
		onkind: (next: EmbeddingKind) => void;
	} = $props();

	function reset() {
		keyword = '';
		keywordScope = defaultFilters().keyword_scope;
		projection = DEFAULT_PROJECTION;
		nNeighbors = DEFAULT_N_NEIGHBORS;
		minDist = DEFAULT_MIN_DIST;
		minClusterSize = DEFAULT_MIN_CLUSTER_SIZE;
		centerByQuestion = DEFAULT_CENTER_BY_QUESTION;
		centerByLanguage = DEFAULT_CENTER_BY_LANGUAGE;
		interviewStatus = defaultFilters().status;
		filterLanguages = defaultFilters().languages;
		includeSynthetic = defaultFilters().include_synthetic;
		filterQuestions = defaultFilters().questions;
		surveyValues = defaultFilters().survey;
		surveyRanges = defaultFilters().survey_ranges;
		// Not counted by `offDefault` — it is a view, not a setting — but a reader
		// reaching for the way back means the whole map, not most of it.
		visibleLanguages = [];
	}

	let clustering = $derived(groupMode === 'cluster');

	const formatNumber = format(',');

	/** The order a selection is kept in, so two chips read the same either way. */
	let codes = $derived(languages.map((language) => language.code));

	/** The guide's sections, or none — which is what hides the question filter. */
	let sections = $derived(guide?.question_sections ?? []);

	/**
	 * Whether the question filter is worth offering.
	 *
	 * Not under the `interview` unit: an interview chunk spans the whole guide
	 * and carries no coordinates, so every pair would filter the map empty. The
	 * page empties the filter for that unit to match; the selection itself is
	 * kept, so switching back to Q&A pairs brings it back.
	 */
	let questionsAvailable = $derived(kind !== 'interview' && sections.length > 0);

	/** How many questions the guide holds, for the "n of m" the heading shows. */
	let questionCount = $derived(
		sections.reduce((total, section) => total + (section.questions?.length ?? 0), 0)
	);

	/** The items worth offering: the ones somebody answered. */
	let facets = $derived(surveyFacets ?? []);

	/** How many items the survey filter narrows by, for the "n of m" heading. */
	let surveyItems = $derived(
		new Set([...Object.keys(surveyValues), ...Object.keys(surveyRanges)]).size
	);

	/** Which survey items are expanded. Collapsed to begin with, like the guide's
	    sections: a project can ask a dozen of these, and the questions are what a
	    reader scans first. */
	const openFacets = new SvelteSet<string>();

	function toggleFacet(key: string) {
		if (openFacets.has(key)) openFacets.delete(key);
		else openFacets.add(key);
	}

	/** The wire spelling of a coordinate, and the key everything here is by. */
	function facetKey(facet: SurveyFacet) {
		return `${facet.section},${facet.main_question}`;
	}

	/**
	 * What to call the item.
	 *
	 * The authored wording where the guide still has the question, and the
	 * coordinate where it does not — an answer to a deleted question is still an
	 * answer, and a blank row could not be told from a bug.
	 */
	function facetLabel(facet: SurveyFacet) {
		return facet.question || `Question ${facet.section + 1}.${facet.main_question + 1}`;
	}

	/** How many of an item's values are chosen, for its own count. */
	function chosenIn(facet: SurveyFacet) {
		const key = facetKey(facet);
		if (facet.filter === 'range') return surveyRanges[key] ? 1 : 0;
		return (surveyValues[key] ?? []).length;
	}

	/**
	 * The input a range end is typed into.
	 *
	 * The item knows what its answers are, so the browser can offer the right
	 * keyboard and picker — and a date typed into a date field comes back in the
	 * ISO spelling the API parses, which is the same reason it is not a text box
	 * with a placeholder saying "YYYY-MM-DD".
	 */
	function rangeInputType(type: string) {
		if (type === 'date') return 'date';
		if (type === 'datetime') return 'datetime-local';
		if (type === 'time') return 'time';
		return 'number';
	}

	/** Which sections are expanded. Collapsed to begin with: a guide of any size
	    is taller than the rail, and the sections are what a reader scans first. */
	const expanded = new SvelteSet<number>();

	function toggleExpanded(index: number) {
		if (expanded.has(index)) expanded.delete(index);
		else expanded.add(index);
	}

	/** How many of a section's questions are selected, for its own count. */
	function selectedInSection(index: number, count: number) {
		let selected = 0;
		for (let question = 0; question < count; question++) {
			if (hasQuestion(filterQuestions, index, question)) selected++;
		}
		return selected;
	}
</script>

<!-- A rule and an icon per group: the rail is one long column of small
     controls, and without a break between them the eye has to read the
     headings to find where one group ends. -->
{#snippet heading(text: string, icon: string)}
	<h3
		class="mt-4 mb-1.5 flex items-center gap-1.5 border-t border-gray-100 pt-4 text-[0.6875rem] font-semibold tracking-wide text-gray-500 uppercase first:mt-0 first:border-t-0 first:pt-0"
	>
		<i class="fas {icon} text-[0.6875rem] text-gray-500"></i>
		{text}
	</h3>
{/snippet}

<!-- A control wide enough to need the whole rail: its name and current value on
     one line, the control itself on the next. Sliders and selects do not fit
     beside a label at this width, and shrinking them to fit would make the one
     thing the reader drags the smallest thing on screen. -->
{#snippet stacked(label: string, hint: string, value: string | null, control: Snippet)}
	<div class="py-1.5">
		<div class="flex items-baseline justify-between gap-2">
			<span class="flex items-center gap-1.5 text-xs text-gray-600">
				{label}
				<HoverInfo text={hint} />
			</span>
			{#if value !== null}
				<span class="font-mono text-xs text-gray-500 tabular-nums">{value}</span>
			{/if}
		</div>
		<div class="mt-1.5">{@render control()}</div>
	</div>
{/snippet}

<!-- A switch and its name, which do fit on one line together. -->
{#snippet inline(label: string, hint: string, control: Snippet)}
	<div class="flex items-center justify-between gap-2 py-1.5">
		<span class="flex items-center gap-1.5 text-xs text-gray-600">
			{label}
			<HoverInfo text={hint} />
		</span>
		{@render control()}
	</div>
{/snippet}

{#snippet toggle(label: string, checked: boolean, set: (value: boolean) => void)}
	<Switch.Root
		{checked}
		onCheckedChange={set}
		aria-label={label}
		class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
	>
		<Switch.Thumb
			class="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.125rem]"
		/>
	</Switch.Root>
{/snippet}

{#snippet groupControl()}
	<!-- One row per mode rather than a segmented strip: four labels do not fit
	     across the rail, and stacking them gives each its own hover text. -->
	<div role="radiogroup" aria-label="Group by" class="flex flex-col gap-0.5">
		{#each modes as mode (mode.value)}
			<button
				type="button"
				role="radio"
				aria-checked={groupMode === mode.value}
				onclick={() => ongroupmode(mode.value)}
				class="flex cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors {groupMode ===
				mode.value
					? 'bg-primary text-on-primary'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
			>
				{mode.label}
				<HoverInfo text={mode.hint} />
			</button>
		{/each}
	</div>
{/snippet}

{#snippet kindControl()}
	<select
		value={kind}
		onchange={(event) => onkind(event.currentTarget.value as EmbeddingKind)}
		aria-label="Unit"
		class="w-full rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
	>
		{#each KINDS as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
{/snippet}

{#snippet statusControl()}
	<select
		bind:value={interviewStatus}
		aria-label="Interview status"
		class="w-full rounded-md border border-gray-200 py-1 pr-7 pl-2 text-xs focus:border-primary focus:ring-0"
	>
		<option value={null}>Any status</option>
		<option value="completed">Completed</option>
		<option value="active">Active</option>
		<option value="inactive">Inactive</option>
	</select>
{/snippet}

{#snippet syntheticControl()}
	{@render toggle('Include test runs', includeSynthetic, (value) => (includeSynthetic = value))}
{/snippet}

{#snippet projectionControl()}
	<div
		role="group"
		aria-label="Projection"
		class="flex overflow-hidden rounded-md border border-gray-200"
	>
		{#each PROJECTIONS as option (option.value)}
			<button
				type="button"
				onclick={() => (projection = option.value)}
				aria-pressed={projection === option.value}
				class="flex-1 cursor-pointer px-2 py-1 text-xs font-medium transition-colors {projection ===
				option.value
					? 'bg-primary text-on-primary'
					: 'bg-white text-gray-500 hover:text-gray-900'}"
			>
				{option.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet neighborsControl()}
	<input
		type="range"
		min={N_NEIGHBORS_RANGE.min}
		max={N_NEIGHBORS_RANGE.max}
		bind:value={nNeighbors}
		aria-label="Neighbours"
		class="w-full accent-primary"
	/>
{/snippet}

{#snippet minDistControl()}
	<input
		type="range"
		min={MIN_DIST_RANGE.min}
		max={MIN_DIST_RANGE.max}
		step={MIN_DIST_RANGE.step}
		bind:value={minDist}
		aria-label="Min distance"
		class="w-full accent-primary"
	/>
{/snippet}

{#snippet clusterSizeControl()}
	<input
		type="range"
		min={MIN_CLUSTER_SIZE_RANGE.min}
		max={maxClusterSize}
		bind:value={minClusterSize}
		disabled={!clustering}
		aria-label="Min cluster size"
		class="w-full accent-primary disabled:cursor-not-allowed"
	/>
{/snippet}

{#snippet questionControl()}
	{@render toggle('Centre by question', centerByQuestion, (value) => (centerByQuestion = value))}
{/snippet}

{#snippet languageControl()}
	{@render toggle('Centre by language', centerByLanguage, (value) => (centerByLanguage = value))}
{/snippet}

<!-- A wrapped row of chips rather than a multi-select: three or four language
     codes fit across the rail, every option is one click from every other, and
     an empty selection has somewhere to be said out loud. "All" is a state, not
     a shortcut — it is what an empty list means, and clicking it clears. -->
{#snippet languageChips(
	name: string,
	selected: LanguageCode[],
	set: (next: LanguageCode[]) => void
)}
	<div role="group" aria-label={name} class="flex flex-wrap gap-1">
		<button
			type="button"
			aria-pressed={selected.length === 0}
			onclick={() => set([])}
			class="cursor-pointer rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors {selected.length ===
			0
				? 'border-primary bg-primary text-on-primary'
				: 'border-gray-200 text-gray-500 hover:text-gray-900'}"
		>
			All
		</button>
		{#each languages as language (language.code)}
			{@const on = selected.includes(language.code)}
			<!-- The code on the chip and the name in the tooltip, rather than the
			     other way round: four names do not fit across the rail, and the
			     codes are what the map's own legend and hover cards say. -->
			<button
				type="button"
				aria-pressed={on}
				aria-label={language.name}
				title={language.count === null
					? language.name
					: `${language.name} — ${formatNumber(language.count)} chunks`}
				onclick={() => set(toggleLanguage(selected, language.code, codes))}
				class="flex cursor-pointer items-baseline gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors {on
					? 'border-primary bg-primary text-on-primary'
					: 'border-gray-200 text-gray-500 hover:text-gray-900'}"
			>
				{language.code.toUpperCase()}
				{#if language.count !== null}
					<span
						class="font-mono text-[0.625rem] tabular-nums {on ? 'opacity-70' : 'text-gray-400'}"
					>
						{formatNumber(language.count)}
					</span>
				{/if}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet visibleLanguageControl()}
	{@render languageChips('Languages shown', visibleLanguages, (next) => (visibleLanguages = next))}
{/snippet}

{#snippet filterLanguageControl()}
	{@render languageChips('Languages included', filterLanguages, (next) => (filterLanguages = next))}
{/snippet}

<!-- The guide as a two-level list: a section per row, its questions under it
     when opened. A flat list of every question does not fit the rail and reads
     as noise; a section-only list cannot isolate the one question a finding is
     about. Both levels write the same `[section, question]` pairs, so a section
     is exactly "all of its questions" and never a second kind of filter. -->
{#snippet guideQuestionControl()}
	<div class="rounded-md border border-gray-200">
		<div class="flex items-center justify-between gap-2 border-b border-gray-100 px-1.5 py-1">
			<span class="text-[0.6875rem] text-gray-500">
				{filterQuestions.length === 0
					? 'All questions'
					: `${filterQuestions.length} of ${questionCount}`}
			</span>
			{#if filterQuestions.length > 0}
				<button
					type="button"
					onclick={() => (filterQuestions = [])}
					class="cursor-pointer text-[0.6875rem] font-medium text-gray-500 transition-colors hover:text-gray-900"
				>
					Clear
				</button>
			{/if}
		</div>

		<div class="max-h-56 overflow-y-auto py-0.5" role="group" aria-label="Questions included">
			{#each sections as section, sectionIdx (sectionIdx)}
				{@const count = section.questions?.length ?? 0}
				{#if count > 0}
					{@const selected = selectedInSection(sectionIdx, count)}
					<div class="px-1">
						<div class="flex items-center gap-1">
							<!-- Separate from the label so opening a section to read it is
							     not the same gesture as selecting the whole of it. -->
							<button
								type="button"
								onclick={() => toggleExpanded(sectionIdx)}
								aria-expanded={expanded.has(sectionIdx)}
								aria-label="{expanded.has(sectionIdx) ? 'Collapse' : 'Expand'} section {sectionIdx +
									1}"
								class="cursor-pointer rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700"
							>
								<i
									class="fas fa-chevron-right text-[0.5625rem] transition-transform {expanded.has(
										sectionIdx
									)
										? 'rotate-90'
										: ''}"
								></i>
							</button>
							<button
								type="button"
								aria-pressed={selected === count}
								title={section.description}
								onclick={() =>
									(filterQuestions = toggleSection(filterQuestions, sectionIdx, count))}
								class="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded px-1 py-0.5 text-left text-[0.6875rem] transition-colors {selected ===
								count
									? 'font-semibold text-primary'
									: 'text-gray-600 hover:text-gray-900'}"
							>
								<span class="truncate">
									{sectionIdx + 1}. {section.description}
								</span>
								<!-- A partly selected section reads "2/5" rather than looking
								     unselected: the section row is the only thing on screen
								     when it is collapsed. -->
								{#if selected > 0}
									<span class="shrink-0 font-mono text-[0.625rem] text-gray-400 tabular-nums">
										{selected === count ? count : `${selected}/${count}`}
									</span>
								{/if}
							</button>
						</div>

						{#if expanded.has(sectionIdx)}
							<div class="mb-0.5 ml-4 flex flex-col">
								{#each section.questions ?? [] as question, questionIdx (questionIdx)}
									{@const on = hasQuestion(filterQuestions, sectionIdx, questionIdx)}
									<button
										type="button"
										aria-pressed={on}
										title={question.main_question}
										onclick={() =>
											(filterQuestions = toggleQuestion(filterQuestions, sectionIdx, questionIdx))}
										class="flex cursor-pointer items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[0.6875rem] transition-colors {on
											? 'bg-primary text-on-primary'
											: 'text-gray-500 hover:text-gray-900'}"
									>
										<span class="shrink-0 font-mono text-[0.625rem] tabular-nums">
											{sectionIdx + 1}.{questionIdx + 1}
										</span>
										<span class="truncate">{question.main_question}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

<!-- The survey items as a list of collapsed rows, opened one at a time. Same
     shape as the guide picker above it, because it is the same gesture on a
     different axis: that one narrows which questions the chunks answer, this
     one narrows whose chunks they are.

     Every value carries the number of interviews behind it. A cohort filter is
     the easiest one to empty a view with — two values nobody holds at once
     return nothing — and the count is what makes that visible before the click
     rather than after it. -->
{#snippet surveyControl()}
	<div class="rounded-md border border-gray-200">
		<div class="flex items-center justify-between gap-2 border-b border-gray-100 px-1.5 py-1">
			<span class="text-[0.6875rem] text-gray-500">
				{surveyItems === 0 ? 'All respondents' : `${surveyItems} of ${facets.length}`}
			</span>
			{#if surveyItems > 0}
				<button
					type="button"
					onclick={() => {
						surveyValues = {};
						surveyRanges = {};
					}}
					class="cursor-pointer text-[0.6875rem] font-medium text-gray-500 transition-colors hover:text-gray-900"
				>
					Clear
				</button>
			{/if}
		</div>

		<div class="max-h-56 overflow-y-auto py-0.5" role="group" aria-label="Survey answers">
			{#each facets as facet (facetKey(facet))}
				{@const key = facetKey(facet)}
				{@const chosen = chosenIn(facet)}
				<div class="px-1">
					<button
						type="button"
						onclick={() => toggleFacet(key)}
						aria-expanded={openFacets.has(key)}
						title={facetLabel(facet)}
						class="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-[0.6875rem] transition-colors {chosen >
						0
							? 'font-semibold text-primary'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						<i
							class="fas fa-chevron-right w-2 shrink-0 text-[0.5625rem] text-gray-400 transition-transform {openFacets.has(
								key
							)
								? 'rotate-90'
								: ''}"
						></i>
						<span class="min-w-0 flex-1 truncate">{facetLabel(facet)}</span>
						<!-- A chosen item reads its count when collapsed, which is the
						     only thing on screen once it is. -->
						{#if chosen > 0}
							<span class="shrink-0 font-mono text-[0.625rem] text-gray-400 tabular-nums">
								{facet.filter === 'range' ? 'set' : chosen}
							</span>
						{/if}
					</button>

					{#if openFacets.has(key)}
						<div class="mb-1 ml-3 flex flex-col gap-0.5">
							{#if facet.filter === 'range'}
								{@const bounds = surveyRanges[key] ?? ['', '']}
								<!-- Both ends optional: "everyone over 60" is a range with
								     one side, and asking for the other would be asking the
								     reader to invent a number. The observed ends are the
								     placeholders, so the field says what it would mean
								     empty. -->
								<div class="flex items-center gap-1 py-0.5">
									<input
										type={rangeInputType(facet.type)}
										value={bounds[0]}
										placeholder={facet.low ?? ''}
										aria-label="{facetLabel(facet)}, from"
										oninput={(event) =>
											(surveyRanges = setSurveyRange(
												surveyRanges,
												key,
												event.currentTarget.value,
												bounds[1]
											))}
										class="w-full min-w-0 rounded border border-gray-200 px-1 py-0.5 text-[0.6875rem] focus:border-primary focus:ring-0"
									/>
									<span class="text-[0.625rem] text-gray-400">to</span>
									<input
										type={rangeInputType(facet.type)}
										value={bounds[1]}
										placeholder={facet.high ?? ''}
										aria-label="{facetLabel(facet)}, to"
										oninput={(event) =>
											(surveyRanges = setSurveyRange(
												surveyRanges,
												key,
												bounds[0],
												event.currentTarget.value
											))}
										class="w-full min-w-0 rounded border border-gray-200 px-1 py-0.5 text-[0.6875rem] focus:border-primary focus:ring-0"
									/>
								</div>
								<span class="px-1 pb-0.5 text-[0.625rem] text-gray-400">
									{formatNumber(facet.n_answered ?? 0)} answered
								</span>
							{:else}
								{#each facet.values ?? [] as value (surveyValueToken(value.option, value.label))}
									{@const token = surveyValueToken(value.option, value.label)}
									{@const on = hasSurveyValue(surveyValues, key, token)}
									<!-- A value nobody gave is shown and disabled rather than
									     hidden: "nobody chose this" is a result, and a filter
									     that can only be set to something is a filter that
									     cannot say so. -->
									<button
										type="button"
										aria-pressed={on}
										disabled={value.count === 0}
										title={value.option === null ? `${value.label} — written in` : value.label}
										onclick={() => (surveyValues = toggleSurveyValue(surveyValues, key, token))}
										class="flex items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[0.6875rem] transition-colors {on
											? 'bg-primary text-on-primary'
											: value.count === 0
												? 'cursor-default text-gray-300'
												: 'cursor-pointer text-gray-500 hover:text-gray-900'}"
									>
										<span class="min-w-0 flex-1 truncate">{value.label}</span>
										<span
											class="shrink-0 font-mono text-[0.625rem] tabular-nums {on
												? 'opacity-70'
												: 'text-gray-400'}"
										>
											{formatNumber(value.count)}
										</span>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/snippet}

{#if open}
	<div
		class="flex shrink-0 flex-col rounded-lg border border-gray-200 bg-white lg:min-h-[26rem] lg:w-[15rem]"
	>
		<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
			<h2 class="text-[0.6875rem] font-semibold tracking-wide text-gray-500 uppercase">Controls</h2>
			<button
				type="button"
				onclick={() => (open = false)}
				aria-label="Hide controls"
				class="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
			>
				<i class="fas fa-angles-left text-[0.6875rem]"></i>
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
			{#if !listing}
				{@render heading('Colour', 'fa-palette')}
				{@render stacked('Group by', 'What the map is coloured by.', null, groupControl)}
			{/if}
			{#if !listing && multilingual}
				{@render stacked(
					'Show',
					'Which languages to look at. The map is not recomputed — the same points stay where they are and the rest fade back, so a language can be picked out of the layout the whole corpus produced. Cluster sizes, counts and purity still describe every point. To leave a language out of the projection itself, use the filter under Corpus.',
					visibleLanguages.length === 0
						? 'All'
						: `${visibleLanguages.length} of ${languages.length}`,
					visibleLanguageControl
				)}
			{/if}

			{@render heading('Corpus', 'fa-layer-group')}
			{@render stacked(
				'Unit',
				KINDS.find((option) => option.value === kind)?.hint ?? '',
				null,
				kindControl
			)}
			{@render stacked(
				'Interviews',
				'Which interviews the chunks are drawn from. Applied in SQL before anything is scored, so it narrows the pool rather than the result list — asking for ten hits from completed interviews returns ten of those.',
				null,
				statusControl
			)}
			{#if multilingual}
				{@render stacked(
					'Languages',
					'Which languages the chunks are drawn from. Applied in SQL before anything is embedded into the projection, so the axes, the clusters and every purity figure are computed over the languages left — a real narrowing of the corpus, and a recompute. To keep the whole map and just look at one language, use Show under Colour.',
					filterLanguages.length === 0 ? 'All' : `${filterLanguages.length} of ${languages.length}`,
					filterLanguageControl
				)}
			{/if}
			{#if questionsAvailable}
				{@render stacked(
					'Questions',
					'Which parts of the interview guide the chunks are drawn from. Applied in SQL before anything is embedded into the projection, exactly as the language filter is — so the axes, the clusters and every purity figure are computed over the questions left. Narrowing to one question is the way to cluster within an answer rather than across the guide, and it makes centring by question redundant: there is only one question left to subtract.',
					filterQuestions.length === 0 ? 'All' : `${filterQuestions.length} of ${questionCount}`,
					guideQuestionControl
				)}
			{/if}
			{#if facets.length > 0}
				{@render stacked(
					'Survey answers',
					'Who the chunks come from, rather than which question they answer. Filtering on an answer keeps every chunk of every interview whose respondent gave it — "what did the dissatisfied ones talk about" — so it narrows the corpus before it is projected, exactly as the language and question filters do. Values within one item are OR-ed and items are AND-ed. The number beside each value is how many interviews gave it, over the whole corpus rather than what is currently filtered: a count that moved as you filtered would let an option vanish from under the selection that produced it.',
					surveyItems === 0 ? 'All' : `${surveyItems} of ${facets.length}`,
					surveyControl
				)}
			{/if}
			{@render inline(
				'Include test runs',
				'Synthetic interviews, run to try the guide out rather than answered by a respondent. Off by default: they are rarely findings.',
				syntheticControl
			)}

			<!-- Everything below shapes a scatter: how it is projected, how tightly
			     it packs, and what HDBSCAN calls a cluster. A list has none of it. -->
			{#if !listing}
				{@render heading('Layout', 'fa-vector-square')}
				{@render stacked(
					'Projection',
					PROJECTIONS.find((option) => option.value === projection)?.hint ?? '',
					null,
					projectionControl
				)}
				{#if projection === 'umap'}
					<!-- UMAP's shape knobs, shown only where they do anything. PCA takes
					     neither, and the page does not send them under it. -->
					{@render stacked(
						'Neighbours',
						'How much of the corpus each point is fitted against. Low keeps local detail and fragments the map; high recovers global structure and smooths the detail away. 15 is a reasonable middle.',
						String(nNeighbors),
						neighborsControl
					)}
					{@render stacked(
						'Min distance',
						'How tightly points may pack. 0 gives the clumped layout HDBSCAN reads best; raising it spreads each blob out, which is easier to look at and harder to cluster.',
						minDist.toFixed(2),
						minDistControl
					)}
				{/if}

				{@render heading('Clustering', 'fa-circle-nodes')}
				<!-- Dimmed away from the clusters, where it changes nothing that is on
				     screen: the positions come from the projection, and the cluster ids
				     it does change are not what the points are coloured by. The centring
				     toggles below stay live in every mode — they move the points
				     themselves, and watching a question's colour scatter as centring
				     comes on is the whole reason to colour by question. -->
				<div class:opacity-40={!clustering}>
					{@render stacked(
						'Min cluster size',
						clustering
							? projection === 'pca'
								? 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Recomputes in about a fifth of a second, so drag it.'
								: 'The smallest group HDBSCAN will call a cluster. Lower it to break the map into finer themes; raise it for a few broad ones. Under UMAP each change is a few seconds, so nudge it rather than dragging.'
							: 'Only affects the clusters, which is not what the map is coloured by right now. Switch back to Clusters to use it.',
						String(minClusterSize),
						clusterSizeControl
					)}
				</div>
				{@render inline(
					'Centre by question',
					"Every respondent was asked the same questions, and a chunk contains its question verbatim — so left alone, clustering recovers the interview guide rather than what anyone said. Centring subtracts each question's average before grouping, leaving the variation between answers. Turn it off to see the raw structure.",
					questionControl
				)}
				{#if multilingual}
					{@render inline(
						'Centre by language',
						"Language is one of the loudest signals in an embedding: left alone, the Danish answers sit with the Danish answers whatever anybody said. Centring subtracts each language's average before grouping, so the map is about what was said rather than what it was said in. Turn it off to see how much of the structure was language.",
						languageControl
					)}
				{/if}
			{/if}
		</div>

		{#if offDefault > 0}
			<!-- The way back, pinned below the scroller so it is reachable without
			     first finding which of eight controls was left somewhere odd. -->
			<div class="border-t border-gray-100 px-3 py-2">
				<button
					type="button"
					onclick={reset}
					class="w-full cursor-pointer rounded-md border border-gray-200 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
				>
					Reset {offDefault} to default{offDefault === 1 ? '' : 's'}
				</button>
			</div>
		{/if}
	</div>
{/if}
