<script lang="ts">
	import { max, min, sum } from 'd3-array';
	import { format } from 'd3-format';
	import { scaleOrdinal } from 'd3-scale';
	import { timeFormat } from 'd3-time-format';
	import { Axis, BarChart, Chart, Circle, Group, PieChart, Svg, Text } from 'layerchart';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let stats = $derived(data.stats);

	let interviewsByStatus = $derived.by(() => {
		const order = ['active', 'completed', 'inactive'];
		const map = new Map(stats.interviews_by_status.map((d) => [d.status, d]));
		return order.map((status) => map.get(status) || { status, count: 0 });
	});

	let interviewsOverTime = $derived.by(() => {
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

	const statusColorScale = scaleOrdinal(
		['active', 'completed', 'inactive'],
		['#e8dcb9', '#196858', '#94a3b8']
	);
	const formatNumber = format(',');
	const formatPercent = format('.1%');
</script>

<div class="space-y-8 p-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold tracking-tight">Project Monitoring</h1>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<!-- 1. KPI Cards -->
		<div class="grid grid-cols-2 gap-4">
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Total Interviews</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-3xl font-bold">{formatNumber(stats.total_interviews)}</span>
					<span class="text-muted-foreground text-sm"
						>({stats.interviews_by_status.find((s) => s.status === 'active')?.count ?? 0} active)</span
					>
				</div>
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Total Messages</div>
				<div class="mt-2 text-3xl font-bold">{formatNumber(stats.total_messages)}</div>
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Completed</div>
				<div class="mt-2 text-3xl font-bold">{formatNumber(stats.total_completed_interviews)}</div>
			</div>
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<div class="text-muted-foreground text-sm font-medium">Completion Rate</div>
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-3xl font-bold">{formatPercent(stats.completion_rate)}</span>
				</div>
				<!-- Simple Progress Bar for Completion Rate -->
				<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#94a3b8]">
					<div class="h-full bg-primary" style="width: {stats.completion_rate * 100}%"></div>
				</div>
			</div>
		</div>

		<!-- 2. Interviews by Status -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Status</h3>
			<div class="h-[300px] w-full">
				<PieChart
					data={interviewsByStatus}
					key="status"
					value="count"
					innerRadius={-20}
					cornerRadius={5}
					padAngle={0.02}
					cRange={['#e8dcb9', '#196858', '#94a3b8']}
					renderContext="svg"
					debug={true}
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
			</div>
			<!-- Legend -->
			<div class="mt-4 flex flex-wrap justify-center gap-4">
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
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- 5. Interviews Per Day -->
		<div class="bg-card col-span-1 rounded-lg border p-6 shadow-sm lg:col-span-2">
			<h3 class="mb-4 text-lg font-medium">Interviews Per Day</h3>
			<div class="h-[300px] w-full">
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
						xAxis: { format: (d) => timeFormat('%b %d')(d) },
						yAxis: { format: 'metric' },
						tooltip: {
							header: { format: (d) => timeFormat('%B %d, %Y')(d) }
						}
					}}
				/>
			</div>
		</div>

		<!-- 6. Duration Stats (Box Plot / Range) -->
		{#if stats.duration_stats}
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-medium">Duration (Seconds)</h3>
				<div class="h-[120px] w-full">
					<!-- Using a simple 1D chart for range -->
					<Chart
						xDomain={[0, stats.duration_stats.max_seconds * 1.1]}
						padding={{ left: 20, right: 20, top: 40, bottom: 40 }}
					>
						{#snippet children({ context: { xScale } })}
							<Svg>
								<Axis placement="bottom" />
								<Group x={0} y={20}>
									<Circle
										cx={xScale(stats.duration_stats!.min_seconds)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.duration_stats!.min_seconds)}
										y={-20}
										value="Min"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
									<Circle
										cx={xScale(stats.duration_stats!.avg_seconds)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.duration_stats!.avg_seconds)}
										y={-20}
										value="Avg"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
									<Circle
										cx={xScale(stats.duration_stats!.max_seconds)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.duration_stats!.max_seconds)}
										y={-20}
										value="Max"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
								</Group>
							</Svg>
						{/snippet}
					</Chart>
				</div>
				<div class="grid grid-cols-3 gap-4 text-center text-sm">
					<div>
						<div class="text-muted-foreground">Min</div>
						<div class="font-bold">{stats.duration_stats.min_seconds}s</div>
					</div>
					<div>
						<div class="text-muted-foreground">Avg</div>
						<div class="font-bold">{Math.round(stats.duration_stats.avg_seconds)}s</div>
					</div>
					<div>
						<div class="text-muted-foreground">Max</div>
						<div class="font-bold">{stats.duration_stats.max_seconds}s</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- 7. Message Count Stats (Bullet / Range) -->
		{#if stats.message_count_stats}
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-medium">Message Count</h3>
				<div class="h-[120px] w-full">
					<Chart
						xDomain={[0, stats.message_count_stats.max_messages * 1.1]}
						padding={{ left: 20, right: 20, top: 40, bottom: 40 }}
					>
						{#snippet children({ context: { xScale } })}
							<Svg>
								<Axis placement="bottom" />
								<Group x={0} y={20}>
									<Circle
										cx={xScale(stats.message_count_stats!.min_messages)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.message_count_stats!.min_messages)}
										y={-20}
										value="Min"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
									<Circle
										cx={xScale(stats.message_count_stats!.avg_messages)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.message_count_stats!.avg_messages)}
										y={-20}
										value="Avg"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
									<Circle
										cx={xScale(stats.message_count_stats!.max_messages)}
										cy={0}
										r={8}
										class="fill-primary"
									/>
									<Text
										x={xScale(stats.message_count_stats!.max_messages)}
										y={-20}
										value="Max"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
								</Group>
							</Svg>
						{/snippet}
					</Chart>
				</div>
				<div class="grid grid-cols-3 gap-4 text-center text-sm">
					<div>
						<div class="text-muted-foreground">Min</div>
						<div class="font-bold">{stats.message_count_stats.min_messages}</div>
					</div>
					<div>
						<div class="text-muted-foreground">Avg</div>
						<div class="font-bold">{Math.round(stats.message_count_stats.avg_messages)}</div>
					</div>
					<div>
						<div class="text-muted-foreground">Max</div>
						<div class="font-bold">{stats.message_count_stats.max_messages}</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
