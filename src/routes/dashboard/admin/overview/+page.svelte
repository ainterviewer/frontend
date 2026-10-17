<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	import { resolve } from '$app/paths';
	import type { AdminStats, RetentionCohort, ScopeCounts } from '$lib/api';

	import type { PageData } from './$types';
	import { RANGES } from './ranges';
	import TimeSeriesChart, { type TimeRow, type TimeSeries } from './TimeSeriesChart.svelte';

	let { data }: { data: PageData } = $props();

	let stats = $derived(data.stats as AdminStats | null);

	type ScopeKey = keyof ScopeCounts;

	// Fixed per entity, never by position: hiding demo must not repaint the
	// others. Slots 1-3 of the validated categorical palette, in stacking order.
	const SCOPES: TimeSeries[] = [
		{ key: 'user', label: 'User', color: '#2a78d6' },
		{ key: 'demo', label: 'Demo', color: '#eb6834' },
		{ key: 'admin', label: 'Admin', color: '#1baf7a' }
	];
	const INTERVIEW_TYPES: TimeSeries[] = [
		{ key: 'distributed', label: 'Distributed', color: '#6250d6' },
		{ key: 'manual_test', label: 'Manual test', color: '#008300' },
		{ key: 'synthetic_test', label: 'Synthetic test', color: '#eda100' }
	];
	const PROJECTS: TimeSeries[] = [{ key: 'projects', label: 'Projects', color: '#196858' }];

	// The table's rows are only built once someone opens it: a year of days is
	// thousands of cells nobody sees on the way to the charts.
	let tableOpen = $state(false);

	const visible = new SvelteSet<ScopeKey>(['user', 'demo', 'admin']);
	let visibleScopes = $derived(SCOPES.filter((s) => visible.has(s.key as ScopeKey)));

	function toggleScope(key: ScopeKey) {
		// Never hide the last one: an empty chart reads as "no users".
		if (visible.has(key) && visible.size > 1) visible.delete(key);
		else visible.add(key);
	}

	let growthMetric = $state<'accounts' | 'usable'>('accounts');

	function sum(counts: ScopeCounts): number {
		let total = 0;
		for (const key of visible) total += counts[key] ?? 0;
		return total;
	}

	function parseDay(day: string): Date {
		const [y, m, d] = day.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function scopeRows(pick: (day: AdminStats['days'][number]) => ScopeCounts): TimeRow[] {
		return (stats?.days ?? []).map((day) => {
			const counts = pick(day);
			return {
				date: parseDay(day.day),
				admin: counts.admin ?? 0,
				user: counts.user ?? 0,
				demo: counts.demo ?? 0
			};
		});
	}

	// Past this many days a bar per day is a hairline, so the bar charts
	// switch to one bar per week (Monday first): counts are summed, daily active
	// users averaged -- summing them would count a user once per day.
	const WEEKLY_AFTER = 120;
	let period = $derived<'day' | 'week'>((stats?.days.length ?? 0) > WEEKLY_AFTER ? 'week' : 'day');

	function byPeriod(rows: TimeRow[], mode: 'sum' | 'mean'): TimeRow[] {
		if (period === 'day') return rows;
		const weeks: Record<number, { row: TimeRow; days: number }> = {};
		for (const row of rows) {
			const d = row.date;
			const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
			const bucket = (weeks[monday.getTime()] ??= { row: { date: monday }, days: 0 });
			bucket.days += 1;
			for (const [key, value] of Object.entries(row)) {
				if (key === 'date') continue;
				bucket.row[key] = ((bucket.row[key] as number) ?? 0) + (value as number);
			}
		}
		return Object.values(weeks).map(({ row, days }) => {
			if (mode === 'sum') return row;
			const mean: TimeRow = { date: row.date };
			for (const [key, value] of Object.entries(row)) {
				if (key !== 'date') mean[key] = Math.round(((value as number) / days) * 10) / 10;
			}
			return mean;
		});
	}

	let growthRows = $derived(scopeRows((d) => d[growthMetric]));
	let signupRows = $derived(
		byPeriod(
			scopeRows((d) => d.signups),
			'sum'
		)
	);
	let activeRows = $derived(
		byPeriod(
			scopeRows((d) => d.active),
			'mean'
		)
	);
	let weeklyRows = $derived(scopeRows((d) => d.weekly_active));
	let interviewRows = $derived(
		byPeriod(
			(stats?.days ?? []).map((d) => ({
				date: parseDay(d.day),
				distributed: d.interviews.distributed ?? 0,
				manual_test: d.interviews.manual_test ?? 0,
				synthetic_test: d.interviews.synthetic_test ?? 0
			})),
			'sum'
		)
	);
	let projectRows = $derived(
		byPeriod(
			(stats?.days ?? []).map((d) => ({ date: parseDay(d.day), projects: d.projects ?? 0 })),
			'sum'
		)
	);

	let tiles = $derived.by(() => {
		if (!stats) return [];
		const s = stats.summary;
		return [
			{
				label: 'Accounts',
				value: sum(s.accounts),
				note: `${sum(s.usable)} not expired`
			},
			{ label: 'Active today', value: sum(s.active_today) },
			{ label: 'Active, 7 days', value: sum(s.active_7d) },
			{ label: 'Active, 30 days', value: sum(s.active_30d) },
			{ label: 'New, 30 days', value: sum(s.new_30d), note: `${sum(s.new_7d)} in the last 7` }
		];
	});

	type MergedCohort = {
		month: string;
		size: number;
		weeks: { week: number; eligible: number; retained: number }[];
	};

	// Cohorts come per scope so the scope toggle applies here too.
	let cohorts = $derived.by(() => {
		const byMonth: Record<string, MergedCohort> = {};
		for (const cohort of (stats?.retention ?? []) as RetentionCohort[]) {
			if (!visible.has(cohort.scope as ScopeKey)) continue;
			const merged = (byMonth[cohort.month] ??= {
				month: cohort.month,
				size: 0,
				weeks: cohort.weeks.map((w) => ({ week: w.week, eligible: 0, retained: 0 }))
			});
			merged.size += cohort.size;
			cohort.weeks.forEach((w, i) => {
				merged.weeks[i].eligible += w.eligible;
				merged.weeks[i].retained += w.retained;
			});
		}
		return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
	});

	let retentionWeeks = $derived(stats?.retention[0]?.weeks.map((w) => w.week) ?? []);

	// One hue, light to dark, for the share retained. The lightest step still
	// clears the surface; text flips to white on the dark half.
	const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];

	function cellStyle(share: number): string {
		const step = Math.min(RAMP.length - 1, Math.floor(share * RAMP.length));
		return `background: ${RAMP[step]}; color: ${step >= 3 ? '#ffffff' : '#1c2826'}`;
	}

	function formatMonth(month: string): string {
		const [y, m] = month.split('-').map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
	}
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h1 class="page-title mb-0">Overview</h1>

	<div class="flex flex-wrap items-center gap-3">
		<div class="flex flex-wrap gap-1.5" role="group" aria-label="Account roles shown">
			{#each SCOPES as scope (scope.key)}
				{@const on = visible.has(scope.key as ScopeKey)}
				<button
					type="button"
					class="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors
						{on
						? 'border-gray-300 bg-white text-dark'
						: 'border-dashed border-gray-300 bg-transparent text-gray-400'}"
					aria-pressed={on}
					onclick={() => toggleScope(scope.key as ScopeKey)}
				>
					<span
						class="inline-block h-2.5 w-2.5 rounded-sm"
						style="background: {on
							? scope.color
							: 'transparent'}; border: 1.5px solid {scope.color}"
					></span>
					{scope.label}
				</button>
			{/each}
		</div>

		<nav class="flex rounded-md border border-gray-300 bg-white p-0.5" aria-label="Date range">
			{#each RANGES as r (r.value)}
				<a
					href={resolve(`/dashboard/admin/overview?range=${r.value}`)}
					class="rounded px-2.5 py-1 text-sm {data.range === r.value
						? 'bg-primary text-on-primary'
						: 'text-gray-600 hover:bg-secondary/40'}"
					aria-current={data.range === r.value ? 'page' : undefined}
					data-sveltekit-noscroll
				>
					{r.label}
				</a>
			{/each}
		</nav>
	</div>
</div>

{#if data.error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<strong class="font-bold">Error!</strong>
		<span class="block sm:inline">{data.error}</span>
	</div>
{/if}

{#if stats}
	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each tiles as tile (tile.label)}
			<div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
				<div class="text-sm text-gray-600">{tile.label}</div>
				<div class="text-2xl font-semibold text-dark tabular-nums">{tile.value}</div>
				{#if tile.note}
					<div class="text-xs text-gray-500">{tile.note}</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-semibold text-dark">User growth</h2>
				<div
					class="flex rounded-md border border-gray-300 p-0.5 text-xs"
					role="group"
					aria-label="Accounts counted"
				>
					{#each [{ value: 'accounts', label: 'All accounts' }, { value: 'usable', label: 'Not expired' }] as const as option (option.value)}
						<button
							type="button"
							class="rounded px-2 py-0.5 {growthMetric === option.value
								? 'bg-secondary text-on-secondary'
								: 'text-gray-600 hover:bg-secondary/40'}"
							aria-pressed={growthMetric === option.value}
							onclick={() => (growthMetric = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
			<TimeSeriesChart rows={growthRows} series={visibleScopes} kind="area" label="accounts" />
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h2 class="mb-2 text-base font-semibold text-dark">Signups per {period}</h2>
			<TimeSeriesChart
				rows={signupRows}
				series={visibleScopes}
				kind="bar"
				label="signups"
				{period}
			/>
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h2 class="mb-2 text-base font-semibold text-dark">
				Daily active users
				{#if period === 'week'}<span class="text-sm font-normal text-gray-500">weekly average</span
					>{/if}
			</h2>
			<TimeSeriesChart rows={activeRows} series={visibleScopes} kind="bar" label="users" {period} />
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h2 class="mb-2 text-base font-semibold text-dark">
				Weekly active users <span class="text-sm font-normal text-gray-500">rolling 7 days</span>
			</h2>
			<TimeSeriesChart rows={weeklyRows} series={visibleScopes} kind="area" label="users" />
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h2 class="mb-2 text-base font-semibold text-dark">Interviews per {period}</h2>
			<TimeSeriesChart
				rows={interviewRows}
				series={INTERVIEW_TYPES}
				kind="bar"
				label="interviews"
				{period}
			/>
		</section>

		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h2 class="mb-2 text-base font-semibold text-dark">Projects created per {period}</h2>
			<TimeSeriesChart rows={projectRows} series={PROJECTS} kind="bar" label="projects" {period} />
		</section>
	</div>

	<section class="mt-4 rounded-lg border border-gray-200 bg-white p-4">
		<h2 class="text-base font-semibold text-dark">Retention by signup month</h2>
		<p class="mb-3 text-sm text-gray-600">
			Share of each cohort active during week <em>n</em> after signing up. Only weeks that are over count;
			a blank cell has nobody old enough yet.
		</p>
		<div class="overflow-x-auto">
			<table class="w-full min-w-md text-sm">
				<thead>
					<tr class="text-left text-gray-600">
						<th class="py-1.5 pr-3 font-medium">Cohort</th>
						<th class="py-1.5 pr-3 text-right font-medium">Users</th>
						{#each retentionWeeks as week (week)}
							<th class="px-1 py-1.5 text-center font-medium">Week {week}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each cohorts as cohort (cohort.month)}
						<tr class="border-t border-gray-100">
							<td class="py-1 pr-3 whitespace-nowrap">{formatMonth(cohort.month)}</td>
							<td class="py-1 pr-3 text-right tabular-nums">{cohort.size}</td>
							{#each cohort.weeks as w (w.week)}
								<td class="p-0.5">
									{#if w.eligible > 0}
										<div
											class="rounded px-1 py-1 text-center tabular-nums"
											style={cellStyle(w.retained / w.eligible)}
											title="{w.retained} of {w.eligible}"
										>
											{Math.round((100 * w.retained) / w.eligible)}%
										</div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<details class="mt-4 rounded-lg border border-gray-200 bg-white p-4" bind:open={tableOpen}>
		<summary class="cursor-pointer text-base font-semibold text-dark">Data table</summary>
		{#if tableOpen}
			<div class="mt-3 max-h-96 overflow-auto">
				<table class="w-full min-w-xl text-sm tabular-nums">
					<thead class="sticky top-0 bg-white">
						<tr class="text-right text-gray-600">
							<th class="py-1.5 pr-3 text-left font-medium">Day</th>
							<th class="py-1.5 pr-3 font-medium">Accounts</th>
							<th class="py-1.5 pr-3 font-medium">Not expired</th>
							<th class="py-1.5 pr-3 font-medium">Signups</th>
							<th class="py-1.5 pr-3 font-medium">Active</th>
							<th class="py-1.5 pr-3 font-medium">Active, 7 days</th>
							<th class="py-1.5 pr-3 font-medium">Interviews</th>
							<th class="py-1.5 font-medium">Projects</th>
						</tr>
					</thead>
					<tbody>
						{#each [...stats.days].reverse() as day (day.day)}
							<tr class="border-t border-gray-100 text-right">
								<td class="py-1 pr-3 text-left">{day.day}</td>
								<td class="py-1 pr-3">{sum(day.accounts)}</td>
								<td class="py-1 pr-3">{sum(day.usable)}</td>
								<td class="py-1 pr-3">{sum(day.signups)}</td>
								<td class="py-1 pr-3">{sum(day.active)}</td>
								<td class="py-1 pr-3">{sum(day.weekly_active)}</td>
								<td class="py-1 pr-3">
									{(day.interviews.distributed ?? 0) +
										(day.interviews.manual_test ?? 0) +
										(day.interviews.synthetic_test ?? 0)}
								</td>
								<td class="py-1">{day.projects}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</details>
{/if}
