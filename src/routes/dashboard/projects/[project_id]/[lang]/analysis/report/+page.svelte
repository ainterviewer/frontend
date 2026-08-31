<script lang="ts">
	import { Report } from '$lib/api';
	import { ANSWER_STATE_COLORS, languageColor } from '$lib/config/chartColors';
	import type { ItemDistribution, ItemDistributions } from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { Switch } from 'bits-ui';
	import { format } from 'd3-format';
	import type { PageData } from './$types';
	import AnswerRateBar from './AnswerRateBar.svelte';
	import ChartSkeleton from './ChartSkeleton.svelte';
	import ClampedText from './ClampedText.svelte';
	import { DISTRIBUTED_ONLY, isDefaultQuery, WITH_TESTS } from './filters';
	import { reveal } from '$lib/utils/reveal';
	import { buildGateMap, questionKey, questionNumber, summarizeConditions } from './conditions';
	import ItemCard from './ItemCard.svelte';

	let { data }: { data: PageData } = $props();

	let stats = $state<ItemDistributions | null>(null);
	let error = $state<string | null>(null);
	let loading = $derived(!stats && !error);

	// Filters. An empty language selection means "every language" rather than
	// "none": the distributions are over the same authored items either way, so
	// pooling the languages is the useful default.
	let selectedLanguages = $state<string[]>([]);
	let completedOnly = $state(false);
	let includeTests = $state(false);

	// Whether every bar is broken down by the language the interview ran in.
	// On by default, because a cohort spanning two languages is two recruitment
	// channels as often as it is one; off pools them into a single series for a
	// reader who is after the shape of the answers and not who gave them.
	let splitByLanguage = $state(false);

	// Held across refetches so the language chips do not disappear while a
	// filtered response is in flight.
	let availableLanguages = $state<string[]>([]);

	const formatNumber = format(',');
	const formatPercent = format('.0%');

	// Tracked outside the effect so re-running it for a changed filter does not
	// read as a project switch.
	let loadedProjectId: string | null = null;

	// `load` has already sent the request for the filters the page opens on, so
	// the first pass through the effect adopts it instead of sending a second.
	// Tracked by identity: a new one arrives with every navigation, and every
	// filter change from there on issues its own.
	let seenPreload: PageData['distributions'] | null = null;

	// The filters belong to the reader, so they survive a refetch -- but not a
	// switch to a different project, whose respondents are different people and
	// whose languages need not overlap at all. Carrying them over also wastes
	// the preload: `load` has just asked for the default cohort, and a filter
	// held over from the last project means nothing can adopt it.
	//
	// Its own effect, declared before the one that fetches, so that one runs
	// once with the filters already back at their defaults instead of firing a
	// request for the old cohort and then a second for the new.
	let filteredProjectId: string | null = null;
	$effect(() => {
		const projectId = data.project_id;
		if (filteredProjectId === projectId) return;

		const firstProject = filteredProjectId === null;
		filteredProjectId = projectId;
		// Nothing to clear on the first pass, and writing the defaults over
		// themselves would only re-run the fetch below for no reason.
		if (firstProject) return;

		selectedLanguages = [];
		completedOnly = false;
		includeTests = false;
		splitByLanguage = true;
		availableLanguages = [];
	});

	// The response is applied here rather than awaited in `load` so navigation
	// never waits on it: the page mounts with its skeletons and fills in when
	// the response lands.
	$effect(() => {
		const projectId = data.project_id;
		const preloaded = data.distributions;
		const query = {
			interview_types: [...(includeTests ? WITH_TESTS : DISTRIBUTED_ONLY)],
			completed_only: completedOnly,
			// The generated client omits an empty array, which is exactly the
			// "no language filter" the backend expects.
			languages: selectedLanguages
		};

		// Switching projects: never show the previous project's distributions as
		// if they belonged to this one. Changing a filter keeps the current
		// charts up until the recount lands, since they describe the same guide.
		if (loadedProjectId !== projectId) {
			loadedProjectId = projectId;
			stats = null;
			error = null;
		}

		let disposed = false;
		// Filters can be toggled faster than the recount comes back; the stale
		// request is not just ignored but dropped, so it stops occupying a
		// connection the request the user is actually waiting on could use.
		const controller = new AbortController();

		// The preloaded request went out before this component existed, so it
		// has no signal to abort; toggling a filter straight away leaves it to
		// finish and discards the result. It only answers the filters `load`
		// sent, so anything else -- filters restored from the URL, say -- has to
		// ask for itself rather than quietly showing the default cohort.
		const adopting = preloaded !== seenPreload && isDefaultQuery(query);
		seenPreload = preloaded;

		const request = adopting
			? preloaded
			: Report.getProjectItemDistributions({
					path: { project_id: projectId },
					query,
					signal: controller.signal
				});

		(async () => {
			const { data: body, error: fetchError } = await request;
			if (disposed) return;

			if (fetchError || !body) {
				// Only surface a hard error when there is nothing to show; a failed
				// recount after a filter change leaves the previous charts up.
				if (!stats) error = 'Failed to load answer distributions';
				return;
			}

			stats = body;
			availableLanguages = body.languages;
			error = null;
		})();

		return () => {
			disposed = true;
			controller.abort();
		};
	});

	// Colour is fixed by a language's position in the project's full list, so
	// narrowing the cohort never recolours the languages left on screen.
	function colorFor(language: string) {
		return languageColor(language, availableLanguages);
	}

	// The languages actually behind the numbers on screen, taken from the
	// response rather than from the filter: a language can be selected and
	// still contribute nothing, and a bar stacked on an empty series is a lie
	// about what was measured.
	let presentLanguages = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const seen = new Set<string>();

		for (const item of stats?.items ?? []) {
			for (const entry of item.counts) {
				for (const language of Object.keys(entry.by_language ?? {})) seen.add(language);
			}
			for (const bucket of item.buckets) {
				for (const language of Object.keys(bucket.by_language ?? {})) seen.add(language);
			}
			for (const sample of item.samples ?? []) seen.add(sample.language);
		}

		// Ordered by the palette assignment, not alphabetically, so the legend
		// and the stack segments run the same way.
		return availableLanguages.filter((language) => seen.has(language));
	});

	// What the charts split by: the split being off is the same thing to them
	// as a single-language cohort, which is what an empty list means here.
	let chartLanguages = $derived(splitByLanguage ? presentLanguages : []);

	// The condition graph, read off the guide the response carries. Inverted
	// once for the page rather than per card, since every card needs the whole
	// set to know whether it is named by another's condition.
	let gateMap = $derived(buildGateMap(stats?.items ?? []));

	let questionTitles = $derived(
		new Map(
			(stats?.items ?? []).map((item) => [
				questionNumber(item.section, item.main_question),
				item.question
			])
		)
	);

	function questionTitleFor(number: string) {
		return questionTitles.get(number);
	}

	// A row of the answer-rate list is marked when the question is conditional,
	// so a low rate that is really "most people never reached this" is not read
	// as a question everybody refused.
	function conditionHint(item: ItemDistribution) {
		const summary = summarizeConditions(item.conditions);
		if (!summary) return null;
		const notAsked = item.n_not_asked_by_condition ?? 0;
		return notAsked > 0 ? `${summary.text} — ${notAsked} never asked` : summary.text;
	}

	type Group = { section: number; description: string; items: ItemDistribution[] };

	let groups = $derived.by((): Group[] => {
		if (!stats) return [];

		const descriptions = new Map(stats.sections.map((s) => [s.section, s.description]));
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const bySection = new Map<number, ItemDistribution[]>();

		// Seed every section the guide declares, so one whose questions are all
		// unanswerable survives the grouping. It plots nothing, but the
		// researcher reading this page is also reading the guide's structure,
		// and a section that silently vanishes misrepresents it.
		for (const section of stats.sections) {
			bySection.set(section.section, []);
		}

		for (const item of stats.items) {
			const existing = bySection.get(item.section);
			if (existing) existing.push(item);
			else bySection.set(item.section, [item]);
		}

		return [...bySection.entries()]
			.sort(([a], [b]) => a - b)
			.map(([section, items]) => ({
				section,
				// A section the guide no longer has still holds real answers, and
				// needs a heading to sit under.
				description: descriptions.get(section) ?? `Section ${section + 1}`,
				items
			}));
	});

	let totalAsked = $derived(stats?.items.reduce((sum, item) => sum + item.n_asked, 0) ?? 0);
	let totalAnswered = $derived(stats?.items.reduce((sum, item) => sum + item.n_answered, 0) ?? 0);
	let overallAnswerRate = $derived(totalAsked > 0 ? totalAnswered / totalAsked : 0);

	// The guide-wide answer rate view: one row per question, in guide order, so
	// a question people consistently skip or quit on is visible at a glance
	// without opening every card.
	// Statements have nothing to rate: they would each contribute a 0% row and
	// push the questions that do have answers out of view.
	let answerRateRows = $derived(stats?.items.filter((item) => item.kind !== 'statement') ?? []);

	// A columnar layout reads down one column and up the next, which stays
	// comfortable only while a column is about a screen tall -- the bound a
	// printed page gives for free and an infinite scroll does not. Blocks of six
	// restore it: the trip back up is never more than three cards, and unequal
	// column heights cost one gap per block rather than one per row.
	const COLUMN_BLOCK = 6;

	function blocksOf<T>(items: T[], size: number): T[][] {
		const blocks: T[][] = [];
		for (let start = 0; start < items.length; start += size) {
			blocks.push(items.slice(start, start + size));
		}
		// A section with nothing to plot still gets one (empty) block, so its
		// heading -- which flows inside the first block -- has somewhere to go.
		return blocks.length > 0 ? blocks : [[]];
	}

	function toggleLanguage(language: string) {
		selectedLanguages = selectedLanguages.includes(language)
			? selectedLanguages.filter((l) => l !== language)
			: [...selectedLanguages, language];
	}
</script>

<div class="flex flex-wrap items-center justify-between gap-4">
	<h1 class="page-title">Report</h1>

	<div class="flex flex-wrap items-center gap-4">
		{#if availableLanguages.length > 1}
			<div class="flex items-center gap-1.5">
				<span class="text-sm text-gray-700">Language</span>
				{#each availableLanguages as language (language)}
					{@const active = selectedLanguages.includes(language)}
					<!-- The swatch is the legend: it is the colour this language takes
					     in every stacked bar below, so the charts need no legend of
					     their own. -->
					<button
						type="button"
						onclick={() => toggleLanguage(language)}
						aria-pressed={active}
						class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors {active
							? 'border-gray-400 bg-surface-200 text-gray-800'
							: 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}"
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full"
							style="background-color: {colorFor(language)}"
						></span>
						{language.toUpperCase()}
					</button>
				{/each}
				<HoverInfo
					text="Pool answers across every language, or pick the ones to count. The items are the same either way — only their wording is translated."
				/>
			</div>
		{/if}

		{#if availableLanguages.length > 1}
			<div class="flex items-center gap-2">
				<Switch.Root
					id="split-by-language"
					bind:checked={splitByLanguage}
					class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
				>
					<Switch.Thumb
						class="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]"
					/>
				</Switch.Root>
				<label for="split-by-language" class="cursor-pointer text-sm text-gray-700">
					Split by language
				</label>
				<HoverInfo
					text="Break every bar down by the language the interview ran in. Turn off to pool them into one series — the counts are the same either way."
				/>
			</div>
		{/if}

		<div class="flex items-center gap-2">
			<Switch.Root
				id="completed-only"
				bind:checked={completedOnly}
				class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			>
				<Switch.Thumb
					class="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]"
				/>
			</Switch.Root>
			<label for="completed-only" class="cursor-pointer text-sm text-gray-700">
				Completed only
			</label>
			<HoverInfo
				text="Count only interviews that reached the end. Turn off to include answers from interviews that were abandoned part-way."
			/>
		</div>

		<div class="flex items-center gap-2">
			<Switch.Root
				id="include-tests"
				bind:checked={includeTests}
				class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			>
				<Switch.Thumb
					class="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]"
				/>
			</Switch.Root>
			<label for="include-tests" class="cursor-pointer text-sm text-gray-700">
				Include test runs
			</label>
			<HoverInfo
				text="Adds your own manual test interviews and synthetic ones to the counts. Off by default, so the distributions describe real respondents."
			/>
		</div>
	</div>
</div>

{#if error}
	<div class="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
{:else}
	<div class="my-8 flex flex-col gap-8">
		<!-- Overview: the cohort these distributions are read against, and where
		     in the guide answers stop coming. -->
		<div class="grid gap-4 lg:grid-cols-[1fr_2fr]">
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<div class="text-sm font-medium text-gray-700">Interviews</div>
					{#if loading}
						<div class="mt-2 h-9 w-20 animate-pulse rounded bg-surface-200"></div>
					{:else}
						<div class="mt-2 text-3xl font-bold">
							{formatNumber(stats?.total_interviews ?? 0)}
						</div>
						<div class="mt-1 text-xs text-gray-500">In the current filter</div>
					{/if}
				</div>
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<div class="text-sm font-medium text-gray-700">Answer Rate</div>
					{#if loading}
						<div class="mt-2 h-9 w-20 animate-pulse rounded bg-surface-200"></div>
						<div class="mt-3 h-2 w-full animate-pulse rounded-full bg-surface-200"></div>
					{:else}
						<div class="mt-2 text-3xl font-bold">{formatPercent(overallAnswerRate)}</div>
						<div
							class="mt-3 h-2 w-full overflow-hidden rounded-full"
							style="background-color: {ANSWER_STATE_COLORS.skipped}"
						>
							<div
								class="h-full transition-all duration-500 ease-out"
								style="width: {overallAnswerRate *
									100}%; background-color: {ANSWER_STATE_COLORS.answered}"
							></div>
						</div>
						<div class="mt-1 text-xs text-gray-500">
							{formatNumber(totalAnswered)} of {formatNumber(totalAsked)} questions asked
						</div>
					{/if}
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="flex items-center justify-between gap-4">
					<div class="text-sm font-medium text-gray-700">Answer Rate by Question</div>
					<div class="flex flex-wrap gap-x-3 gap-y-1">
						{#each [['Answered', ANSWER_STATE_COLORS.answered], ['Skipped', ANSWER_STATE_COLORS.skipped], ['Dropped out', ANSWER_STATE_COLORS.dropped]] as [label, color] (label)}
							<div class="flex items-center gap-1.5">
								<div class="h-2 w-2 shrink-0 rounded-full" style="background-color: {color}"></div>
								<span class="text-xs text-gray-500">{label}</span>
							</div>
						{/each}
					</div>
				</div>
				<div class="mt-4">
					{#if loading}
						<ChartSkeleton rows bars={6} />
					{:else if answerRateRows.length === 0}
						<div class="py-6 text-center text-sm text-gray-500">
							This project's interview guide has no questions yet.
						</div>
					{:else}
						<div class="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
							{#each answerRateRows as item (`${item.section}-${item.main_question}`)}
								{@const hint = conditionHint(item)}
								<!-- Revealed per row, not per list: the list scrolls, so revealing
								     it whole would animate every row below its own fold unseen. -->
								<div
									{@attach reveal()}
									class="grid grid-cols-[minmax(0,15rem)_1fr] items-center gap-3"
								>
									<!-- One tooltip for the whole label rather than one on the row and
									     another on the branch icon: nesting a trigger inside a trigger makes
									     which one is showing depend on where the pointer happened to land. -->
									<HoverInfo asChild contentClass="max-w-sm">
										{#snippet content()}
											<div class="flex flex-col gap-1">
												<span>{item.question}</span>
												{#if hint}
													<!-- The rate beside it is over the respondents who were asked, so a
													     conditional question's row is a rate within its own subset and
													     not within the cohort. -->
													<span class="text-amber-700">{hint}</span>
												{/if}
											</div>
										{/snippet}
										{#snippet children({ props })}
											<div {...props} class="truncate text-left text-xs text-gray-700">
												<span class="text-gray-400 tabular-nums">
													{item.section + 1}.{item.main_question + 1}
												</span>
												{#if hint}
													<i
														class="fa-solid fa-code-branch text-[0.625rem] text-amber-500"
														aria-label="Conditional question"
													></i>
												{/if}
												{item.question}
											</div>
										{/snippet}
									</HoverInfo>
									<AnswerRateBar
										asked={item.n_asked}
										answered={item.n_answered}
										skipped={item.n_skipped}
										compact
									/>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- The distributions themselves, grouped the way the guide is written. -->
		{#if loading}
			{#each [0, 1] as group (group)}
				<section class="flex flex-col gap-4">
					<div class="h-4 w-40 animate-pulse rounded bg-surface-200"></div>
					<div class="grid items-start gap-4 lg:grid-cols-2">
						{#each [0, 1] as card (card)}
							<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
								<div class="h-4 w-2/3 animate-pulse rounded bg-surface-200"></div>
								<div class="mt-4">
									<ChartSkeleton rows bars={4} />
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{:else if groups.length === 0}
			<div class="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
				<div class="text-sm font-medium">Nothing to plot yet</div>
				<div class="mt-1 text-sm">
					Distributions appear here once the guide has questions and interviews have been answered.
				</div>
			</div>
		{:else}
			{#each groups as group, groupIndex (group.section)}
				<!-- The heading sits inside a column and so is only half the page
				     wide; a rule across the full width is what actually marks where
				     one section ends and the next begins. -->
				<section
					class="flex flex-col gap-4 {groupIndex > 0 ? 'border-t border-gray-200 pt-8' : ''}"
				>
					<!-- Columns, not a grid: a grid row is as tall as its tallest card,
					     and option counts vary enough that half of every row was
					     whitespace. -->
					{#each blocksOf(group.items, COLUMN_BLOCK) as block, index (index)}
						<div class="-mb-4 gap-4 lg:columns-2">
							<!-- The heading flows in the first column rather than spanning
							     the section, so it sits where reading starts and the eye
							     is pointed down the column instead of across. It also
							     balances as an item, which is why the first block rarely
							     ends ragged. -->
							{#if index === 0}
								{@render sectionHeading(group)}
								{#if group.items.length === 0}
									<p class="mb-4 text-xs text-gray-400 italic">
										No answerable questions in this section.
									</p>
								{/if}
							{/if}
							{#each block as item (`${item.section}-${item.main_question}`)}
								<div class="mb-4 break-inside-avoid">
									<ItemCard
										{item}
										languages={chartLanguages}
										{colorFor}
										gates={gateMap.get(questionKey(item.section, item.main_question)) ?? []}
										{questionTitleFor}
									/>
								</div>
							{/each}
						</div>
					{/each}
				</section>
			{/each}
		{/if}
	</div>
{/if}

<!-- A section's `description` is prompt context for the prober, not a heading:
     it routinely runs to a paragraph. The heading is the position, and the
     description sits under it as prose, clamped until asked for. -->
{#snippet sectionHeading(group: (typeof groups)[number])}
	<div class="mb-4 break-inside-avoid">
		<h2 class="text-sm font-semibold text-gray-700">Section {group.section + 1}</h2>
		{#if group.description}
			<ClampedText text={group.description} />
		{/if}
	</div>
{/snippet}
