<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Synthesize } from '$lib/api';
	import type { ModelOption, RunComparison } from '$lib/api/types.gen';
	import { describeModel, isTestOnly } from '$lib/content/models';
	import { pairInterviews, personaSummary, runStats } from '$lib/simulations/compare';

	import SimulationActionBar from '../../SimulationActionBar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const projectId = $derived(page.params.project_id as string);
	const lang = $derived(page.params.lang ?? '');
	const testId = $derived(page.params.test_id as string);
	const runIds = $derived(page.url.searchParams.getAll('run'));

	let runs = $state<RunComparison[]>([]);
	let loading = $state(true);
	let failed = $state(false);

	async function load() {
		const { data: comparison, error } = await Synthesize.compareTestRuns({
			path: { project_id: projectId, test_id: testId },
			query: { run_id: runIds }
		});
		loading = false;
		failed = !!error;
		if (comparison) runs = comparison.runs;
	}

	// Again every ten seconds while a run is still going, as the runs page does.
	const running = $derived(runs.some((r) => r.run.status === 'running'));
	$effect(() => {
		void runIds;
		load();
	});
	$effect(() => {
		if (!running) return;
		const timer = setInterval(load, 10000);
		return () => clearInterval(timer);
	});

	const rows = $derived(pairInterviews(runs));
	const stats = $derived(runs.map(runStats));
	const models: ModelOption[] = $derived(data.models);

	function interviewerName(run: RunComparison) {
		return run.run.interviewer_model ? describeModel(run.run.interviewer_model) : null;
	}

	const columns = $derived(`repeat(${Math.max(runs.length, 1)}, minmax(18rem, 1fr))`);
	const runsHref = $derived(
		resolve('/dashboard/projects/[project_id]/[lang]/tests/simulations/[test_id]/runs', {
			project_id: projectId,
			lang,
			test_id: testId
		})
	);
</script>

<div class="flex min-h-full flex-col pb-32">
	<div class="flex-1">
		<a
			href={runsHref}
			class="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary"
		>
			<i class="fa-solid fa-arrow-left"></i>
			Back to runs
		</a>

		<h1 class="page-title">Compare runs</h1>
		<p class="mb-8 text-gray-600">
			The same synthetic interviewees, interviewed by each run's model. Read across a row to see how
			the models handle the same person.
		</p>

		{#if loading}
			<p class="text-sm text-gray-500">Loading…</p>
		{:else if failed}
			<p class="text-sm text-red-700">These runs could not be loaded.</p>
		{:else}
			<div class="overflow-x-auto">
				<div class="grid gap-4" style:grid-template-columns={columns}>
					{#each runs as run, i (run.run.id)}
						{@const model = interviewerName(run)}
						{@const s = stats[i]}
						<div class="rounded-lg border border-gray-200 bg-white p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									{#if model}
										<p class="truncate font-medium text-gray-900">{model.name}</p>
										<p class="text-xs text-gray-500">{model.provider}</p>
									{:else}
										<p class="font-medium text-gray-900">The project's models</p>
										<p class="text-xs text-gray-500">As configured on the Agents page</p>
									{/if}
								</div>
								{#if run.run.interviewer_model && isTestOnly(models, run.run.interviewer_model)}
									<span
										class="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-800"
										>Test only</span
									>
								{/if}
							</div>
							<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
								<div>
									<dt class="text-xs text-gray-500">Completed</dt>
									<dd class="tabular-nums">
										{s.completed} / {run.run.n_interviews}
										{#if run.run.status === 'running'}
											<i class="fa-solid fa-spinner fa-spin ml-1 text-xs text-gray-400"></i>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500">Questions per interview</dt>
									<dd class="tabular-nums">{s.questions.toFixed(1)}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500">Follow-ups per interview</dt>
									<dd class="tabular-nums">{s.followUps.toFixed(1)}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500">Words per message</dt>
									<dd class="tabular-nums">{s.wordsPerMessage.toFixed(0)}</dd>
								</div>
							</dl>
						</div>
					{/each}
				</div>

				{#if rows.length === 0}
					<p class="mt-8 text-sm text-gray-500">No interviews yet.</p>
				{/if}

				{#each rows as row (row.key)}
					<h2 class="mt-8 mb-2 text-sm font-medium text-gray-700">
						<i class="fa-solid fa-user mr-1 text-gray-400"></i>
						{personaSummary(row.persona)}
					</h2>
					<div class="grid gap-4" style:grid-template-columns={columns}>
						{#each row.interviews as interview, i (i)}
							<div
								class="max-h-[32rem] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3"
							>
								{#if !interview}
									<p class="text-sm text-gray-400">No interview with this person in this run.</p>
								{:else if interview.turns.length === 0}
									<p class="text-sm text-gray-400">Not started yet.</p>
								{:else}
									<ol class="space-y-2">
										{#each interview.turns as turn, t (t)}
											<li
												class={[
													'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
													turn.role === 'assistant'
														? 'mr-6 bg-white text-gray-900 shadow-sm'
														: 'ml-6 bg-primary/10 text-gray-800'
												]}
											>
												{#if turn.role === 'assistant' && turn.sub_question}
													<span
														class="mb-0.5 block text-[0.65rem] font-medium text-gray-400 uppercase"
														>Follow-up</span
													>
												{/if}
												{turn.content}
											</li>
										{/each}
									</ol>
									{#if interview.status !== 'completed'}
										<p class="mt-2 text-xs text-gray-400">{interview.status}</p>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<SimulationActionBar current="runs" />
</div>
