<script lang="ts">
	import { Monitoring } from '$lib/api';
	import { LANGUAGE_COLORS, OTHER_LANGUAGE_COLOR } from '$lib/config/chartColors';
	import type {
		DropoutStage,
		HistogramBucket,
		InterviewStatus,
		MonitoringStats
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import LazyMount from '$lib/components/LazyMount.svelte';
	import { Switch } from 'bits-ui';
	import { max, min, sum } from 'd3-array';
	import { format } from 'd3-format';
	import { scaleOrdinal } from 'd3-scale';
	import { timeFormat } from 'd3-time-format';
	import { BarChart, PieChart, Text } from 'layerchart';
	import { Tween } from 'svelte/motion';
	import type { PageData } from './$types';
	import ChartSkeleton from './ChartSkeleton.svelte';
	import DropoutChart from './DropoutChart.svelte';
	import HistogramChart from './HistogramChart.svelte';

	const POLL_INTERVAL = 15_000;

	let { data }: { data: PageData } = $props();

	let stats = $state<MonitoringStats | null>(null);
	let error = $state<string | null>(null);
	let loading = $derived(!stats && !error);
	let deduplicateByPid = $state(false);

	const statusColorScale = scaleOrdinal(
		['active', 'completed', 'inactive'],
		['#e8dcb9', '#196858', '#94a3b8']
	);
	const formatNumber = format(',');
	const formatPercent = format('.1%');

	// Animated KPI values
	const totalInterviews = Tween.of(() => stats?.total_interviews ?? 0, { duration: 400 });
	const totalMessages = Tween.of(() => stats?.message_count_stats?.sum_messages ?? 0, {
		duration: 400
	});
	const totalDuration = Tween.of(() => stats?.duration_stats?.sum_seconds ?? 0, { duration: 400 });
	const completionRate = Tween.of(() => stats?.completion_rate ?? 0, { duration: 400 });
	const participationRate = Tween.of(() => stats?.participation_rate ?? 0, { duration: 400 });

	const MAX_LANGUAGE_SLICES = LANGUAGE_COLORS.length;

	type LanguageSlice = { language: string; count: number; share: number; color: string };

	let languageBreakdown = $derived.by(() => {
		const counts = stats?.interviews_by_language ?? [];
		const total = sum(counts, (d) => d.count);
		if (total === 0) return [] as LanguageSlice[];

		// The backend already orders by count descending, so the head is the
		// dominant language and the tail is what gets folded together.
		const head = counts.slice(0, MAX_LANGUAGE_SLICES);
		const tail = counts.slice(MAX_LANGUAGE_SLICES);

		const slices: LanguageSlice[] = head.map((d, i) => ({
			language: d.language.toUpperCase(),
			count: d.count,
			share: d.count / total,
			color: LANGUAGE_COLORS[i]
		}));

		if (tail.length > 0) {
			const otherCount = sum(tail, (d) => d.count);
			slices.push({
				language: 'Other',
				count: otherCount,
				share: otherCount / total,
				color: OTHER_LANGUAGE_COLOR
			});
		}

		return slices;
	});

	let dominantLanguage = $derived(languageBreakdown[0] ?? null);

	// An anonymous-link project has no participant roster, so there is no
	// denominator to divide by and the card is left out entirely.
	let hasParticipants = $derived((stats?.total_participants ?? 0) > 0);

	// Tracked outside the effect so that re-running it for a changed
	// deduplication setting does not read as a project switch.
	let loadedProjectId: string | null = null;

	// Fetched here rather than in `load` so navigation never waits on it: the page
	// mounts with its skeletons and fills in when the first response lands, then
	// keeps itself up to date by polling.
	$effect(() => {
		const projectId = data.project_id;
		const deduplicate = deduplicateByPid;

		// Switching projects: never show the previous project's numbers as if
		// they belonged to this one. Toggling deduplication keeps the current
		// numbers on screen until the recount lands, since they describe the
		// same project either way.
		if (loadedProjectId !== projectId) {
			loadedProjectId = projectId;
			stats = null;
			error = null;
		}

		let disposed = false;
		let inFlight = false;
		// One controller for the whole run: it only ever fires on teardown, so
		// whichever poll is in flight at that moment is the one to drop.
		const controller = new AbortController();

		async function refresh(initial = false) {
			// Skip while a request is still running or the tab is in the
			// background — the query is expensive and the page is not visible.
			if (disposed || inFlight || (!initial && document.hidden)) return;
			inFlight = true;
			try {
				const { data: statsData, error: fetchError } = await Monitoring.getProjectMonitoringStats({
					path: { project_id: projectId },
					query: { deduplicate_by_pid: deduplicate },
					signal: controller.signal
				});
				if (disposed) return;
				if (fetchError || !statsData) {
					// Only surface a hard error when there is nothing to show; a
					// failed recount after a toggle leaves the previous numbers up.
					if (initial && !stats) error = 'Failed to load monitoring stats';
				} else {
					stats = statsData;
					error = null;
				}
			} catch (e) {
				// Includes the abort below, which is this component's own doing.
				if (disposed) return;
				console.error('Failed to fetch monitoring stats:', e);
				if (initial && !stats) error = 'Failed to load monitoring stats';
			} finally {
				inFlight = false;
			}
		}

		refresh(true);
		const interval = setInterval(() => refresh(), POLL_INTERVAL);
		// Refresh straight away when the user returns, since polling was paused.
		const onVisibilityChange = () => {
			if (!document.hidden) refresh();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			disposed = true;
			controller.abort();
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	let interviewsByStatus = $derived.by(() => {
		if (!stats) return [];
		const order: InterviewStatus[] = ['active', 'completed', 'inactive'];
		const map = new Map(stats.interviews_by_status.map((d) => [d.status, d]));
		return order.map((status) => map.get(status) || { status, count: 0 });
	});

	// `interviewsByStatus` always has all three statuses once stats are loaded, so
	// emptiness has to be judged by the counts rather than the array length.
	let hasStatusData = $derived(sum(interviewsByStatus, (d) => d.count) > 0);

	let interviewsOverTime = $derived.by(() => {
		if (!stats) return [];
		const items = stats.interviews_over_time.map((d) => ({
			...d,
			date: new Date(d.date),
			unfinished_count: d.count - d.completed_count
		}));

		if (items.length === 0) return [];

		const minDate = min(items, (d) => d.date);
		const maxDate = max(items, (d) => d.date);

		if (!minDate || !maxDate) return items;

		const filled = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const current = new Date(minDate);
		const end = new Date(maxDate);
		const itemMap = new Map(items.map((d) => [d.date.toISOString().slice(0, 10), d]));

		while (current <= end) {
			const dateStr = current.toISOString().slice(0, 10);
			const existing = itemMap.get(dateStr);

			if (existing) {
				filled.push(existing);
			} else {
				filled.push({
					date: new Date(current),
					count: 0,
					completed_count: 0,
					unfinished_count: 0
				});
			}
			current.setDate(current.getDate() + 1);
		}

		return filled;
	});

	function formatDuration(seconds: number): string {
		if (seconds >= 3600) {
			return `${Math.round(seconds / 3600)}h`;
		}
		return `${Math.round(seconds / 60)}m`;
	}

	function addClosingTick(buckets: HistogramBucket[] | undefined | null): HistogramBucket[] {
		if (!buckets || buckets.length === 0) return [];
		if (buckets.length === 1) return buckets;

		const step = buckets[buckets.length - 1].value - buckets[buckets.length - 2].value;
		const last = buckets[buckets.length - 1];
		const nextValue = last.value + step;

		return [
			...buckets,
			{
				value: nextValue,
				count: 0,
				label: `${nextValue}`
			}
		];
	}

	let durationHistogram = $derived(addClosingTick(stats?.duration_histogram));
	let messageCountHistogram = $derived(addClosingTick(stats?.message_count_histogram));
	let messageLengthHistogram = $derived(addClosingTick(stats?.message_length_histogram));

	let timeOfDayHistogram = $derived.by(() => {
		if (!stats?.interviews_by_time_of_day || stats.interviews_by_time_of_day.length === 0)
			return [];
		// Fill all 24 hours and add closing tick at hour 24
		const map = new Map(stats.interviews_by_time_of_day.map((d) => [Number(d.time), d.count]));
		const buckets = [];
		for (let h = 0; h <= 24; h++) {
			buckets.push({
				value: h,
				count: h === 24 ? 0 : (map.get(h) ?? 0),
				label: `${String(h).padStart(2, '0')}:00`
			});
		}
		return buckets;
	});
	// The dropout chart is laid out as a single run of bars with section
	// grouping bands drawn under it.
	type DropoutBar = {
		key: string;
		label: string;
		count: number;
		tooltip: string;
		// The authored text of the question this bar sits on, when the guide
		// still has one at these indices. A probe carries its parent question's
		// text: probes are generated during the interview, so the guide has no
		// wording for them.
		questionText: string | null;
		section: number | null;
		isProbe: boolean;
	};
	type DropoutBand = {
		section: number | null;
		label: string;
		description: string | null;
		span: number;
	};

	const DROPOUT_STAGE_LABELS: Record<DropoutStage, string> = {
		never_started: 'Never started',
		introduction: 'Introduction',
		question: '',
		outro: 'Outro'
	};

	let dropoutChart = $derived.by(() => {
		const points = stats?.dropout_stats;
		if (!points?.length) return { bars: [] as DropoutBar[], bands: [] as DropoutBand[] };

		const descriptions = new Map<number, string>(
			(stats?.dropout_sections ?? []).map((s) => [s.section, s.description])
		);
		const questionTexts = new Map<string, string>(
			(stats?.dropout_sections ?? []).flatMap((s) =>
				s.questions.map((text, i): [string, string] => [`${s.section}-${i}`, text])
			)
		);

		// The backend zero-fills main questions from the interview guide, but a
		// probe only exists once it has been asked, so probes surface only where
		// someone actually dropped out on one. Left alone that renders a lone
		// "probe 2" with no probe 1 beside it, which reads as a mistake. Record
		// the highest probe seen per question so the run can be filled up to it.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const maxSub = new Map<string, number>();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const counts = new Map<string, number>();
		for (const point of points) {
			if (point.stage !== 'question') continue;
			const question = `${point.section}-${point.main_question}`;
			const sub = point.sub_question ?? 0;
			maxSub.set(question, Math.max(maxSub.get(question) ?? 0, sub));
			counts.set(`${question}-${sub}`, point.count);
		}

		const bars: DropoutBar[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this computation, never escapes
		const seen = new Set<string>();

		for (const point of points) {
			if (point.stage !== 'question') {
				const label = DROPOUT_STAGE_LABELS[point.stage];
				bars.push({
					key: point.stage,
					label,
					count: point.count,
					tooltip: label,
					questionText: null,
					section: null,
					isProbe: false
				});
				continue;
			}

			// A question and all of its probes are emitted together, the first time
			// the question is reached; the remaining points for it are already
			// covered by that expansion.
			const question = `${point.section}-${point.main_question}`;
			if (seen.has(question)) continue;
			seen.add(question);

			// Sections and questions are zero-based indices; they read as ordinals.
			const main = (point.main_question ?? 0) + 1;
			const sectionLabel = `Section ${(point.section ?? 0) + 1}`;
			// Missing whenever the interview ran against a snapshot whose
			// questions the current draft no longer has at these indices, and for
			// a shuffled section, where the recorded index is the position the
			// respondent was asked in rather than the authored one.
			const questionText = questionTexts.get(question) ?? null;

			for (let sub = 0; sub <= (maxSub.get(question) ?? 0); sub++) {
				bars.push({
					// Question numbers restart in every section, so the section has to
					// be part of the key or Section 2's Q1 would land on Section 1's bar.
					key: `${question}-${sub}`,
					// The section band underneath already says which section this is,
					// and the probe marker distinguishes the two kinds of tick, so the
					// question number carries no prefix.
					label: sub === 0 ? `${main}` : `↳${sub}`,
					count: counts.get(`${question}-${sub}`) ?? 0,
					tooltip:
						sub === 0
							? `${sectionLabel} · Question ${main}`
							: `${sectionLabel} · Question ${main} · Probe ${sub}`,
					questionText,
					section: point.section,
					isProbe: sub > 0
				});
			}
		}

		// Bars for a section are contiguous, so a band only needs to know how many
		// bars it spans.
		const bands: DropoutBand[] = [];
		for (const bar of bars) {
			const current = bands.at(-1);
			if (current && current.section === bar.section) {
				current.span += 1;
				continue;
			}
			bands.push({
				section: bar.section,
				label: bar.section === null ? '' : `Section ${bar.section + 1}`,
				description: bar.section === null ? null : (descriptions.get(bar.section) ?? null),
				span: 1
			});
		}

		return { bars, bands };
	});
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="page-title">Project Monitoring</h1>
	<div class="flex items-center gap-2">
		<Switch.Root
			id="deduplicate-by-pid"
			bind:checked={deduplicateByPid}
			class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-gray-200 bg-gray-200 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
		>
			<Switch.Thumb
				class="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]"
			/>
		</Switch.Root>
		<label for="deduplicate-by-pid" class="cursor-pointer text-sm text-gray-700">
			Deduplicate by participant
		</label>
		<HoverInfo
			text="Counts one interview per participant ID, keeping the one with most progress. Turn off to count every interview, including repeat visits from the same participant."
		/>
	</div>
</div>

{#if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
{:else}
	<div class="my-8 grid grid-cols-2 gap-4">
		<!-- 1. KPI Cards -->
		<div class="grid grid-cols-2 gap-4">
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="text-sm font-medium text-gray-700">Total Interviews</div>
				{#if loading}
					<div class="mt-2 h-9 w-32 animate-pulse rounded bg-surface-200"></div>
				{:else}
					<div class="mt-2 flex items-baseline gap-2">
						<span class="text-3xl font-bold"
							>{formatNumber(Math.round(totalInterviews.current))}</span
						>
						<span class="text-sm text-gray-500"
							>({stats?.interviews_by_status.find((s) => s.status === 'active')?.count ?? 0} active)</span
						>
					</div>
				{/if}
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="text-sm font-medium text-gray-700">Completion Rate</div>
				{#if loading}
					<div class="mt-2 h-9 w-24 animate-pulse rounded bg-surface-200"></div>
				{:else}
					<div class="mt-2 flex items-baseline gap-2">
						<span class="text-3xl font-bold">{formatPercent(completionRate.current)}</span>
					</div>
				{/if}
				<!-- Simple Progress Bar for Completion Rate -->
				{#if loading}
					<div class="mt-3 h-2 w-full animate-pulse rounded-full bg-surface-200"></div>
				{:else}
					<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#94a3b8]">
						<div
							class="h-full bg-primary transition-all duration-500 ease-out"
							style="width: {completionRate.current * 100}%"
						></div>
					</div>
				{/if}
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="text-sm font-medium text-gray-700">Total Messages</div>
				{#if loading}
					<div class="mt-2 h-9 w-28 animate-pulse rounded bg-surface-200"></div>
					<div class="mt-2 h-3 w-40 animate-pulse rounded bg-surface-200"></div>
				{:else}
					<div class="mt-2 text-3xl font-bold">
						{formatNumber(Math.round(totalMessages.current))}
					</div>
				{/if}
				{#if stats?.message_count_stats}
					<div class="mt-1 text-xs text-gray-500">
						Min {stats.message_count_stats.min_messages} · Avg {Math.round(
							stats.message_count_stats.avg_messages
						)} · Max {stats.message_count_stats.max_messages}
					</div>
				{/if}
			</div>
			{#if loading || hasParticipants}
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<div class="text-sm font-medium text-gray-700">Participation Rate</div>
					{#if loading}
						<div class="mt-2 h-9 w-24 animate-pulse rounded bg-surface-200"></div>
						<div class="mt-3 h-2 w-full animate-pulse rounded-full bg-surface-200"></div>
					{:else}
						<div class="mt-2 flex items-baseline gap-2">
							<span class="text-3xl font-bold">{formatPercent(participationRate.current)}</span>
							<span class="text-sm text-gray-500">
								({stats?.participants_completed ?? 0} of {stats?.total_participants ?? 0})
							</span>
						</div>
						<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#94a3b8]">
							<div
								class="h-full bg-primary transition-all duration-500 ease-out"
								style="width: {participationRate.current * 100}%"
							></div>
						</div>
						<div class="mt-1 text-xs text-gray-500">
							Invited participants with a completed interview
						</div>
					{/if}
				</div>
			{/if}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="text-sm font-medium text-gray-700">Total Duration</div>
				{#if loading}
					<div class="mt-2 h-9 w-24 animate-pulse rounded bg-surface-200"></div>
					<div class="mt-2 h-3 w-40 animate-pulse rounded bg-surface-200"></div>
				{:else}
					<div class="mt-2 text-3xl font-bold">
						{formatDuration(totalDuration.current)}
					</div>
				{/if}
				{#if stats?.duration_stats}
					<div class="mt-1 text-xs text-gray-500">
						Min {formatDuration(stats.duration_stats.min_seconds)} · Avg {formatDuration(
							stats.duration_stats.avg_seconds
						)} · Max {formatDuration(stats.duration_stats.max_seconds)}
					</div>
				{/if}
			</div>
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
				class:col-span-2={!loading && !hasParticipants}
			>
				<div class="text-sm font-medium text-gray-700">Language Distribution</div>
				{#if loading}
					<div class="mt-2 h-9 w-28 animate-pulse rounded bg-surface-200"></div>
					<div class="mt-3 h-2 w-full animate-pulse rounded-full bg-surface-200"></div>
					<div class="mt-3 h-3 w-40 animate-pulse rounded bg-surface-200"></div>
				{:else if dominantLanguage}
					<div class="mt-2 flex items-baseline gap-2">
						<span class="text-3xl font-bold">{dominantLanguage.language}</span>
						<span class="text-sm text-gray-500">{formatPercent(dominantLanguage.share)}</span>
					</div>
					<!-- Segments are separated by a surface-coloured gap rather than
					     sitting flush, so neighbouring hues stay distinguishable. -->
					<div class="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
						{#each languageBreakdown as slice (slice.language)}
							<div
								class="h-full first:rounded-l-full last:rounded-r-full"
								style="width: {slice.share * 100}%; background-color: {slice.color}"
							></div>
						{/each}
					</div>
					<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
						{#each languageBreakdown as slice (slice.language)}
							<div class="flex items-center gap-1.5">
								<div
									class="h-2 w-2 shrink-0 rounded-full"
									style="background-color: {slice.color}"
								></div>
								<span class="text-xs text-gray-500">
									{slice.language}
									{formatPercent(slice.share)}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="mt-2 text-3xl font-bold text-gray-400">&mdash;</div>
					<div class="mt-1 text-xs text-gray-500">No data available</div>
				{/if}
			</div>
		</div>

		<!-- 2. Interviews by Status -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Status</h3>
			<div class="h-75 w-full">
				{#if hasStatusData}
					<LazyMount class="h-full w-full">
						{#snippet placeholder()}
							<div class="flex h-full items-center justify-center">
								<div class="h-[200px] w-[200px] animate-pulse rounded-full bg-surface-200"></div>
							</div>
						{/snippet}
						{#snippet children(animate)}
							<PieChart
								data={interviewsByStatus}
								key="status"
								value="count"
								innerRadius={-20}
								cornerRadius={5}
								padAngle={0.02}
								cRange={['#e8dcb9', '#196858', '#94a3b8']}
								props={{
									// On `pie`, not `arc`: the chart hands each arc an explicit
									// start and end angle, and an arc with those set ignores its
									// own motion. The sweep is the pie's, which tweens the angle
									// the whole layout is generated at.
									pie: {
										motion: animate ? { type: 'spring', stiffness: 0.1, damping: 0.4 } : undefined
									}
								}}
							>
								{#snippet aboveMarks()}
									<Text
										value={formatNumber(sum(interviewsByStatus, (d) => d.count))}
										textAnchor="middle"
										verticalAnchor="middle"
										class="text-4xl"
										dy={4}
									/>
									<Text
										value="interviews"
										textAnchor="middle"
										verticalAnchor="middle"
										class="fill-surface-content/50 text-sm"
										dy={26}
									/>
								{/snippet}
							</PieChart>
						{/snippet}
					</LazyMount>
				{:else if loading}
					<!-- Skeleton placeholder -->
					<div class="flex h-full items-center justify-center">
						<div class="h-[200px] w-[200px] animate-pulse rounded-full bg-surface-200"></div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center">
						<span class="text-sm text-gray-500">No data available</span>
					</div>
				{/if}
			</div>
			<!-- Legend -->
			<div class="mt-4 flex flex-wrap justify-center gap-4">
				{#if hasStatusData}
					{#each interviewsByStatus as item (item.status)}
						<div class="flex items-center gap-2">
							<div
								class="h-3 w-3 rounded-full"
								style="background-color: {statusColorScale(item.status)}"
							></div>
							<span class="text-sm text-gray-700 capitalize">{item.status} ({item.count})</span>
						</div>
					{/each}
				{:else if loading}
					<!-- Skeleton legend -->
					{#each ['active', 'completed', 'inactive'] as status (status)}
						<div class="flex animate-pulse items-center gap-2">
							<div
								class="h-3 w-3 rounded-full"
								style="background-color: {statusColorScale(status)}"
							></div>
							<span class="text-sm text-gray-700 capitalize">{status}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- 3. Interviews Per Day -->
		<div class="col-span-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
			<h3 class="mb-4 text-lg font-medium">Interviews Per Day</h3>
			<div class="h-75 w-full">
				{#if interviewsOverTime.length > 0}
					<LazyMount class="h-full w-full">
						{#snippet placeholder()}
							<ChartSkeleton bars={20} />
						{/snippet}
						{#snippet children(animate)}
							<BarChart
								data={interviewsOverTime}
								x="date"
								series={[
									{
										key: 'unfinished_count',
										label: 'Inactive',
										color: statusColorScale('inactive')
									},
									{
										key: 'completed_count',
										label: 'Completed',
										color: statusColorScale('completed')
									}
								]}
								seriesLayout="stack"
								padding={{ left: 40, bottom: 24, right: 20, top: 20 }}
								props={{
									xAxis: {
										format: (d) => timeFormat('%b %d')(d),
										classes: { tickLabel: 'text-xs' }
									},
									yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
									tooltip: {
										header: { format: (d) => timeFormat('%B %d, %Y')(d) }
									},
									bars: { motion: animate ? { type: 'tween', duration: 300 } : undefined }
								}}
							/>
						{/snippet}
					</LazyMount>
				{:else if loading}
					<ChartSkeleton bars={20} />
				{:else}
					<div class="flex h-full items-center justify-center">
						<span class="text-sm text-gray-500">No data available</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- 4. Interviews by Time of Day -->
		<div class="col-span-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Time of Day</h3>
			{#if timeOfDayHistogram.length > 0}
				<LazyMount class="h-75 w-full">
					{#snippet placeholder()}
						<ChartSkeleton />
					{/snippet}
					{#snippet children(animate)}
						<HistogramChart data={timeOfDayHistogram} {animate} />
					{/snippet}
				</LazyMount>
			{:else if loading}
				<ChartSkeleton />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-sm text-gray-500">No data available</span>
				</div>
			{/if}
		</div>
		<!-- 5. Duration Histogram -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Duration (seconds)</h3>
			{#if durationHistogram.length > 0}
				<LazyMount class="h-75 w-full">
					{#snippet placeholder()}
						<ChartSkeleton />
					{/snippet}
					{#snippet children(animate)}
						<HistogramChart data={durationHistogram} {animate} />
					{/snippet}
				</LazyMount>
			{:else if loading}
				<ChartSkeleton />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-sm text-gray-500">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 6. Message Count Histogram -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Message Count</h3>
			{#if messageCountHistogram.length > 0}
				<LazyMount class="h-75 w-full">
					{#snippet placeholder()}
						<ChartSkeleton />
					{/snippet}
					{#snippet children(animate)}
						<HistogramChart data={messageCountHistogram} {animate} />
					{/snippet}
				</LazyMount>
			{:else if loading}
				<ChartSkeleton />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-sm text-gray-500">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 7. Message Length Histogram -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Message Length (characters)</h3>
			{#if messageLengthHistogram.length > 0}
				<LazyMount class="h-75 w-full">
					{#snippet placeholder()}
						<ChartSkeleton />
					{/snippet}
					{#snippet children(animate)}
						<HistogramChart data={messageLengthHistogram} tooltipLabel="Messages" {animate} />
					{/snippet}
				</LazyMount>
			{:else if loading}
				<ChartSkeleton />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-sm text-gray-500">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 8. Dropout Stats -->
		<div class="col-span-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
			<div class="mb-4">
				<h3 class="text-lg font-medium">Dropout Analysis</h3>
				{#if stats}
					<p class="text-sm text-gray-500">
						{formatNumber(stats.total_inactive)} inactive interviews
					</p>
				{/if}
			</div>
			<div class="h-75 w-full">
				{#if dropoutChart.bars.length > 0}
					<LazyMount class="h-full w-full">
						{#snippet placeholder()}
							<ChartSkeleton bars={20} />
						{/snippet}
						{#snippet children(animate)}
							<DropoutChart bars={dropoutChart.bars} bands={dropoutChart.bands} {animate} />
						{/snippet}
					</LazyMount>
				{:else if loading}
					<ChartSkeleton bars={20} />
				{:else}
					<div class="flex h-full items-center justify-center">
						<span class="text-sm text-gray-500">No data available</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
