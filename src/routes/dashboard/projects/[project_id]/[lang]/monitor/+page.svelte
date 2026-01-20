<script lang="ts">
	import { sum, min, max } from 'd3-array';
	import { format } from 'd3-format';
	import { scaleOrdinal } from 'd3-scale';
	import { timeFormat } from 'd3-time-format';
	import {
		Axis,
		Bars,
		Chart,
		Circle,
		Grid,
		PieChart,
		Group,
		Highlight,
		Rule,
		Svg,
		Text,
		Tooltip
	} from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let stats = $derived(data.stats);

	let interviewsOverTime = $derived.by(() => {
		const items = stats.interviews_over_time.map((d) => ({
			...d,
			date: new Date(d.date)
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
					completed_count: 0
				});
			}
			current.setDate(current.getDate() + 1);
		}

		return filled;
	});

	const statusColorScale = scaleOrdinal(
		['active', 'completed', 'inactive'],
		['#3b82f6', '#22c55e', '#94a3b8']
	);
	const formatNumber = format(',');
	const formatPercent = format('.1%');
</script>

<div class="space-y-8 p-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold tracking-tight">Project Monitoring</h1>
	</div>

	<!-- 1. KPI Cards -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
			<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
				<div class="h-full bg-primary" style="width: {stats.completion_rate * 100}%"></div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- 5. Interviews Per Day -->
		<div class="bg-card col-span-1 rounded-lg border p-6 shadow-sm lg:col-span-2">
			<h3 class="mb-4 text-lg font-medium">Interviews Per Day</h3>
			<div class="h-[300px] w-full">
				<Chart
					data={interviewsOverTime}
					x="date"
					xScale={scaleBand().padding(0.2)}
					y="count"
					yDomain={[0, null]}
					yNice
					padding={{ left: 40, bottom: 24, right: 20, top: 20 }}
					tooltip={{ mode: 'band' }}
				>
					<Svg>
						<Axis placement="left" grid rule />
						<Axis placement="bottom" format={(d) => timeFormat('%b %d')(d)} rule />
						<Grid strokeDasharray="2" />

						<!-- Total Interviews Bar -->
						<Bars radius={4} class="fill-primary" />

						<Highlight area />
					</Svg>
					<Tooltip.Root let:data>
						<Tooltip.Header>{timeFormat('%B %d, %Y')(data.date)}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item label="Total" value={data.count} />
							<Tooltip.Item label="Completed" value={data.completed_count} color="#22c55e" />
						</Tooltip.List>
					</Tooltip.Root>
				</Chart>
			</div>
		</div>

		<!-- 2. Interviews by Status -->
		<div class="bg-card rounded-lg border p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Interviews by Status</h3>
			<div class="h-[300px] w-full">
				<PieChart
					data={stats.interviews_by_status}
					key="status"
					value="count"
					innerRadius={-20}
					cornerRadius={5}
					padAngle={0.02}
					cRange={['#3b82f6', '#22c55e', '#94a3b8']}
					renderContext="svg"
					debug={true}
				>
					{#snippet aboveMarks()}
						<Text
							value={formatNumber(sum(stats.interviews_by_status, (d) => d.count))}
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
				{#each stats.interviews_by_status as item}
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

		<!-- 6. Duration Stats (Box Plot / Range) -->
		{#if stats.duration_stats}
			<div class="bg-card rounded-lg border p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-medium">Duration Stats (Seconds)</h3>
				<div class="h-[120px] w-full">
					<!-- Using a simple 1D chart for range -->
					<Chart
						data={[stats.duration_stats]}
						x="max_seconds"
						xDomain={[0, stats.duration_stats.max_seconds * 1.1]}
						padding={{ left: 20, right: 20, top: 40, bottom: 40 }}
					>
						<Svg>
							<Axis placement="bottom" />
							<!-- Range Line -->
							<Group x={0} y={20}>
								<!-- Min to Max line -->
								<Rule
									x1={stats.duration_stats.min_seconds}
									x2={stats.duration_stats.max_seconds}
									y1={0}
									y2={0}
									class="stroke-muted-foreground/50 stroke-linecap-round stroke-[4px]"
								/>
								<!-- Min Tick -->
								<Rule
									x={stats.duration_stats.min_seconds}
									y1={-10}
									y2={10}
									class="stroke-muted-foreground stroke-2"
								/>
								<!-- Max Tick -->
								<Rule
									x={stats.duration_stats.max_seconds}
									y1={-10}
									y2={10}
									class="stroke-muted-foreground stroke-2"
								/>

								<!-- Avg Circle -->
								<Circle cx={stats.duration_stats.avg_seconds} cy={0} r={8} class="fill-primary" />
								<Text
									x={stats.duration_stats.avg_seconds}
									y={-20}
									value="Avg"
									textAnchor="middle"
									class="fill-foreground text-xs"
								/>

								<!-- Median Circle (if exists) -->
								{#if stats.duration_stats.median_seconds}
									<Circle
										cx={stats.duration_stats.median_seconds}
										cy={0}
										r={6}
										class="fill-secondary"
									/>
									<Text
										x={stats.duration_stats.median_seconds}
										y={25}
										value="Med"
										textAnchor="middle"
										class="fill-foreground text-xs"
									/>
								{/if}
							</Group>
						</Svg>
					</Chart>
				</div>
				<div class="grid grid-cols-4 gap-4 text-center text-sm">
					<div>
						<div class="text-muted-foreground">Min</div>
						<div class="font-bold">{stats.duration_stats.min_seconds}s</div>
					</div>
					<div>
						<div class="text-muted-foreground">Avg</div>
						<div class="font-bold">{Math.round(stats.duration_stats.avg_seconds)}s</div>
					</div>
					<div>
						<div class="text-muted-foreground">Median</div>
						<div class="font-bold">{stats.duration_stats.median_seconds ?? '-'}s</div>
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
				<h3 class="mb-4 text-lg font-medium">Message Count Stats</h3>
				<div class="h-[120px] w-full">
					<Chart
						data={[stats.message_count_stats]}
						x="max_messages"
						xDomain={[0, stats.message_count_stats.max_messages * 1.1]}
						padding={{ left: 20, right: 20, top: 40, bottom: 40 }}
					>
						<Svg>
							<Axis placement="bottom" />
							<Group x={0} y={20}>
								<Rule
									x1={stats.message_count_stats.min_messages}
									x2={stats.message_count_stats.max_messages}
									y1={0}
									y2={0}
									class="stroke-muted-foreground/50 stroke-linecap-round stroke-[4px]"
								/>
								<Rule
									x={stats.message_count_stats.min_messages}
									y1={-10}
									y2={10}
									class="stroke-muted-foreground stroke-2"
								/>
								<Rule
									x={stats.message_count_stats.max_messages}
									y1={-10}
									y2={10}
									class="stroke-muted-foreground stroke-2"
								/>
								<Circle
									cx={stats.message_count_stats.avg_messages}
									cy={0}
									r={8}
									class="fill-primary"
								/>
								<Text
									x={stats.message_count_stats.avg_messages}
									y={-20}
									value="Avg"
									textAnchor="middle"
									class="fill-foreground text-xs"
								/>
							</Group>
						</Svg>
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
