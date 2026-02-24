<script lang="ts">
	import { Monitoring } from '$lib/api';
	import type { HistogramBucket, InterviewStatus, MonitoringStats } from '$lib/api/types.gen';
	import { max, min, sum } from 'd3-array';
	import { format } from 'd3-format';
	import { scaleOrdinal } from 'd3-scale';
	import { timeFormat } from 'd3-time-format';
	import { BarChart, PieChart, Text } from 'layerchart';
	import { Tween } from 'svelte/motion';
	import { SvelteDate } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import HistogramChart from './HistogramChart.svelte';

	let { data }: { data: PageData } = $props();

	let stats = $state<MonitoringStats | null>(null);
	let error = $state<string | null>(null);

	const statusColorScale = scaleOrdinal(
		['active', 'completed', 'inactive'],
		['#e8dcb9', '#196858', '#94a3b8']
	);
	const formatNumber = format(',');
	const formatPercent = format('.1%');

	async function fetchStats() {
		const { data: statsData, error: fetchError } = await Monitoring.getProjectMonitoringStats({
			path: {
				project_id: data.project_id
			}
		});

		if (fetchError) {
			error = 'Failed to load monitoring stats';
			return;
		}

		stats = statsData;
	}

	$effect(() => {
		fetchStats();
	});

	// Animated KPI values
	const totalInterviews = new Tween(0, { duration: 400 });
	const totalMessages = new Tween(0, { duration: 400 });
	const totalDuration = new Tween(0, { duration: 400 });
	const completionRate = new Tween(0, { duration: 400 });

	$effect(() => {
		if (stats) {
			totalInterviews.set(stats.total_interviews);
			totalMessages.set(stats.message_count_stats?.sum_messages ?? 0);
			totalDuration.set(stats.duration_stats?.sum_seconds ?? 0);
			completionRate.set(stats.completion_rate);
		}
	});

	$effect(() => {
		const interval = setInterval(async () => {
			try {
				const { data: statsData } = await Monitoring.getProjectMonitoringStats({
					path: { project_id: data.project_id }
				});
				if (statsData) {
					stats = statsData;
				}
			} catch (e) {
				console.error('Failed to fetch monitoring stats:', e);
			}
		}, 5000);

		return () => clearInterval(interval);
	});

	let interviewsByStatus = $derived.by(() => {
		if (!stats) return [];
		const order: InterviewStatus[] = ['active', 'completed', 'inactive'];
		const map = new Map(stats.interviews_by_status.map((d) => [d.status, d]));
		return order.map((status) => map.get(status) || { status, count: 0 });
	});

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
		const current = new SvelteDate(minDate);
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
	let dropoutStats = $derived.by(() => {
		if (!stats?.dropout_stats) return [];

		// Filter to only include entries with a main_question
		const validStats = stats.dropout_stats.filter((d) => d.main_question !== null);
		if (validStats.length === 0) return [];

		// Create a map for quick lookup of existing data
		const dataMap = new Map<string, number>();
		for (const d of validStats) {
			const key = `${d.main_question}-${d.sub_question ?? 0}`;
			dataMap.set(key, d.count);
		}

		// Find the range of main questions and max sub_question per main question
		const maxSubByMain = new Map<number, number>();
		for (const d of validStats) {
			const main = d.main_question!;
			const sub = d.sub_question ?? 0;
			maxSubByMain.set(main, Math.max(maxSubByMain.get(main) ?? 0, sub));
		}

		const maxMain = Math.max(...maxSubByMain.keys());

		// Generate all labels in the range
		const result: { main_question: number; sub_question: number; count: number; label: string }[] =
			[];

		for (let main = 0; main <= maxMain; main++) {
			// Get max sub_question for this main question (0 if no entries exist)
			const maxSub = maxSubByMain.get(main) ?? 0;

			for (let sub = 0; sub <= maxSub; sub++) {
				const key = `${main}-${sub}`;
				const count = dataMap.get(key) ?? 0;
				const label = sub === 0 ? `Q${main}` : `${main}.${sub}`;

				result.push({
					main_question: main,
					sub_question: sub,
					count,
					label
				});
			}
		}

		return result;
	});
</script>

<h1 class="page-title">Project Monitoring</h1>

{#if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
{:else}
	<div class="my-8 grid grid-cols-2 gap-4">
		<!-- 1. KPI Cards -->
		<div class="grid grid-cols-2 gap-4">
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Total Interviews</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-3xl font-bold">{formatNumber(Math.round(totalInterviews.current))}</span
					>
					<span class="text-muted-foreground text-sm"
						>({stats?.interviews_by_status.find((s) => s.status === 'active')?.count ?? 0} active)</span
					>
				</div>
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Completion Rate</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-3xl font-bold">{formatPercent(completionRate.current)}</span>
				</div>
				<!-- Simple Progress Bar for Completion Rate -->
				<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#94a3b8]">
					<div
						class="h-full bg-primary transition-all duration-500 ease-out"
						style="width: {completionRate.current * 100}%"
					></div>
				</div>
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Total Messages</div>
				<div class="mt-2 text-3xl font-bold">
					{formatNumber(Math.round(totalMessages.current))}
				</div>
				{#if stats?.message_count_stats}
					<div class="text-muted-foreground mt-1 text-xs">
						Min {stats.message_count_stats.min_messages} · Avg {Math.round(
							stats.message_count_stats.avg_messages
						)} · Max {stats.message_count_stats.max_messages}
					</div>
				{/if}
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Total Duration</div>
				<div class="mt-2 text-3xl font-bold">
					{formatDuration(totalDuration.current)}
				</div>
				{#if stats?.duration_stats}
					<div class="text-muted-foreground mt-1 text-xs">
						Min {formatDuration(stats.duration_stats.min_seconds)} · Avg {formatDuration(
							stats.duration_stats.avg_seconds
						)} · Max {formatDuration(stats.duration_stats.max_seconds)}
					</div>
				{/if}
			</div>
		</div>

		<!-- 2. Interviews by Status -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Status</h3>
			<div class="h-75 w-full">
				{#if interviewsByStatus.length > 0}
					<PieChart
						data={interviewsByStatus}
						key="status"
						value="count"
						innerRadius={-20}
						cornerRadius={5}
						padAngle={0.02}
						cRange={['#e8dcb9', '#196858', '#94a3b8']}
						renderContext="svg"
						props={{
							arc: { motion: { type: 'spring', stiffness: 0.1, damping: 0.4 } }
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
				{:else}
					<!-- Skeleton placeholder -->
					<div class="flex h-full items-center justify-center">
						<div class="bg-muted h-[200px] w-[200px] animate-pulse rounded-full"></div>
					</div>
				{/if}
			</div>
			<!-- Legend -->
			<div class="mt-4 flex flex-wrap justify-center gap-4">
				{#if interviewsByStatus.length > 0}
					{#each interviewsByStatus as item}
						<div class="flex items-center gap-2">
							<div
								class="h-3 w-3 rounded-full"
								style="background-color: {statusColorScale(item.status)}"
							></div>
							<span class="text-muted-foreground text-sm capitalize"
								>{item.status} ({item.count})</span
							>
						</div>
					{/each}
				{:else}
					<!-- Skeleton legend -->
					{#each ['active', 'completed', 'inactive'] as status}
						<div class="flex items-center gap-2">
							<div
								class="h-3 w-3 rounded-full"
								style="background-color: {statusColorScale(status)}"
							></div>
							<span class="text-muted-foreground text-sm capitalize">{status} (0)</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- 3. Interviews Per Day -->
		<div class="bg-card col-span-1 rounded-lg border p-6 shadow-sm lg:col-span-2">
			<h3 class="mb-4 text-lg font-medium">Interviews Per Day</h3>
			<div class="h-75 w-full">
				{#if interviewsOverTime.length > 0}
					<BarChart
						data={interviewsOverTime}
						x="date"
						series={[
							{ key: 'unfinished_count', label: 'Inactive', color: statusColorScale('inactive') },
							{ key: 'completed_count', label: 'Completed', color: statusColorScale('completed') }
						]}
						seriesLayout="stack"
						padding={{ left: 40, bottom: 24, right: 20, top: 20 }}
						props={{
							xAxis: { format: (d) => timeFormat('%b %d')(d), classes: { tickLabel: 'text-xs' } },
							yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
							tooltip: {
								header: { format: (d) => timeFormat('%B %d, %Y')(d) }
							},
							bars: { motion: { type: 'tween', duration: 300 } }
						}}
					/>
				{:else}
					<div class="flex h-full items-center justify-center">
						<span class="text-muted-foreground text-sm">No data available</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- 4. Interviews by Time of Day -->
		<div class="bg-card col-span-1 rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Time of Day</h3>
			{#if timeOfDayHistogram.length > 0}
				<HistogramChart data={timeOfDayHistogram} />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-muted-foreground text-sm">No data available</span>
				</div>
			{/if}
		</div>
		<!-- 5. Duration Histogram -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Duration (seconds)</h3>
			{#if durationHistogram.length > 0}
				<HistogramChart data={durationHistogram} />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-muted-foreground text-sm">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 6. Message Count Histogram -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Message Count</h3>
			{#if messageCountHistogram.length > 0}
				<HistogramChart data={messageCountHistogram} />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-muted-foreground text-sm">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 7. Message Length Histogram -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Message Length (characters)</h3>
			{#if messageLengthHistogram.length > 0}
				<HistogramChart data={messageLengthHistogram} tooltipLabel="Messages" />
			{:else}
				<div class="flex h-75 w-full items-center justify-center">
					<span class="text-muted-foreground text-sm">No data available</span>
				</div>
			{/if}
		</div>

		<!-- 8. Dropout Stats -->
		<div class="bg-card col-span-1 rounded-lg border p-6 shadow-sm lg:col-span-2">
			<h3 class="mb-4 text-lg font-medium">Dropout Analysis</h3>
			<div class="h-75 w-full">
				{#if dropoutStats.length > 0}
					<BarChart
						data={dropoutStats}
						x="label"
						y="count"
						series={[{ key: 'count', label: 'Dropouts', color: '#94a3b8' }]}
						padding={{ left: 40, bottom: 24, right: 20, top: 20 }}
						props={{
							xAxis: { classes: { tickLabel: 'text-xs' } },
							yAxis: { format: 'metric', classes: { tickLabel: 'text-xs' } },
							tooltip: {
								header: {
									format: (d) => {
										if (d.startsWith('Q')) {
											return `Main Question ${d.substring(1)}`;
										}
										const [main, sub] = d.split('.');
										return `Main Question ${main} Sub Question ${sub}`;
									}
								}
							},
							bars: { motion: { type: 'tween', duration: 300 } }
						}}
					/>
				{:else}
					<div class="flex h-full items-center justify-center">
						<span class="text-muted-foreground text-sm">No data available</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
