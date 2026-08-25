<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Synthesize } from '$lib/api';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { SynthesizeRequest } from '$lib/api/types.gen';
	import type { PageData } from './$types';
	import SimulationActionBar from '../SimulationActionBar.svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		NO_PAGINATION,
		formatDate,
		formatDateFull,
		matchesSelection,
		sortableText,
		sortableTime,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';

	let isAdmin = $derived(page.data.user?.scope === 'admin');

	let { data }: { data: PageData } = $props();

	// getTestStatus has no response model in the OpenAPI schema; this mirrors
	// the backend's test run rows.
	type TestRun = {
		id: string;
		status: string;
		created_at: string;
		language?: string | null;
		n_interviews?: number | null;
		answering_model?: string | null;
	};

	let testRuns = $state<TestRun[]>([]);
	let loading = $state(false);
	let hasLoaded = $state(false);
	let running = $state(false);

	// Form defaults seeded once from the loaded test; deliberately not reactive to prop updates.
	const initialTest = untrack(() => data.test);
	let nInterviews = $state(initialTest.n_interviews ?? 1);
	let delayBeforeAnswers = $state(initialTest.delay_before_answers?.[0] ?? 0);
	let delayBeforeAnswersRandom = $state(initialTest.delay_before_answers?.[1] ?? 0);
	let answeringModel = $state(initialTest.answering_model ?? '');
	let language = $state(initialTest.language ?? page.params.lang);

	let refreshInterval: ReturnType<typeof setInterval>;

	const projectId = $derived(page.params.project_id as string);
	const lang = $derived(page.params.lang);
	const testId = $derived(page.params.test_id as string);

	async function loadTestRuns() {
		loading = true;
		const { data: statusData, error: statusError } = await Synthesize.getTestStatus({
			path: { project_id: projectId, test_id: testId }
		});
		if (statusError) {
			console.error('Failed to load test runs', statusError);
			testRuns = [];
		} else {
			testRuns = (statusData as TestRun[]) || [];
		}
		loading = false;
		hasLoaded = true;
	}

	async function runTest() {
		if (delayBeforeAnswersRandom > delayBeforeAnswers) {
			toast.error('The random delay cannot be greater than the base delay.');
			return;
		}

		running = true;
		const body: SynthesizeRequest = {
			n_interviews: nInterviews,
			answering_model: answeringModel || null,
			language,
			delay_before_answers: delayBeforeAnswers
				? [delayBeforeAnswers, delayBeforeAnswersRandom]
				: null
		};

		const { error: runError } = await Synthesize.runSyntheticTest({
			path: { project_id: projectId, test_id: testId },
			body
		});
		if (runError) {
			console.error('Failed to run test', runError);
			toast.error('Failed to run test');
			running = false;
			return;
		}

		await loadTestRuns();
		running = false;
	}

	function getStatusClass(status: string) {
		switch (status) {
			case 'running':
				return 'bg-blue-100 text-blue-700';
			case 'completed':
				return 'bg-green-100 text-green-700';
			case 'failed':
				return 'bg-red-100 text-red-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	}

	function hasRunningTests() {
		return testRuns.some((run) => run.status === 'running');
	}

	function startAutoRefresh() {
		if (refreshInterval) clearInterval(refreshInterval);
		refreshInterval = setInterval(() => {
			if (hasRunningTests()) {
				loadTestRuns();
			}
		}, 10000);
	}

	$effect(() => {
		loadTestRuns();
		startAutoRefresh();
		console.log(answeringModel);
		return () => {
			if (refreshInterval) clearInterval(refreshInterval);
		};
	});

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, TestRun>();

	const columns = helper.columns([
		helper.accessor((r) => sortableTime(r.created_at), {
			id: 'created_at',
			header: 'Created',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor((r) => sortableText(r.language), {
			id: 'language',
			header: 'Language',
			sortFn: 'text',
			sortUndefined: 'last',
			filterFn: matchesSelection,
			meta: { class: 'text-gray-600' }
		}),
		helper.accessor((r) => r.n_interviews ?? 0, {
			id: 'n_interviews',
			header: 'N interviews',
			sortFn: 'basic',
			meta: { class: 'tabular-nums text-gray-600' }
		}),
		helper.display({
			id: 'question_model',
			header: 'Question model',
			meta: { class: 'text-gray-600' }
		}),
		helper.accessor((r) => sortableText(r.answering_model), {
			id: 'answering_model',
			header: 'Answering model',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'text-gray-600' }
		}),
		helper.accessor((r) => sortableText(r.status), {
			id: 'status',
			header: 'Status',
			sortFn: 'text',
			sortUndefined: 'last',
			filterFn: matchesSelection
		})
	]);

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return testRuns;
		},
		getRowId: (r) => r.id,
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'created_at', desc: true }] }
	});

	const columnLabels: Record<string, string> = {
		created_at: 'Created',
		language: 'Language',
		n_interviews: 'N interviews',
		question_model: 'Question model',
		answering_model: 'Answering model',
		status: 'Status'
	};
</script>

<div class="flex min-h-full flex-col pb-32">
	<div class="flex-1">
		<a
			href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations`)}
			class="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary"
		>
			<i class="fa-solid fa-arrow-left"></i>
			Back to simulations
		</a>

		<h1 class="page-title">Run</h1>
		<p class="mb-8 text-gray-600">
			Run a number of synthetic interviews to test your interview guide and configuration.
		</p>

		<h2 class="mb-4 text-lg font-medium text-gray-800">Settings</h2>

		<div class="mb-6 space-y-6">
			<div>
				<label for="n-interviews" class="mb-1 block text-sm font-medium text-gray-700"
					>Number of synthetic interviews</label
				>
				<input
					id="n-interviews"
					type="number"
					bind:value={nInterviews}
					min="1"
					max="50"
					class="w-20 rounded border-gray-300 focus:border-primary focus:ring-primary"
				/>
			</div>

			{#if isAdmin}
				<div>
					<h3 class="mb-2 text-sm font-medium text-gray-700">Delay before answers</h3>
					<div class="space-y-4">
						<div>
							<label for="delay-before-answers" class="mb-1 block text-sm text-gray-600">
								Delay before the agent answers each question:
							</label>
							<input
								id="delay-before-answers"
								type="number"
								bind:value={delayBeforeAnswers}
								min="0"
								class="w-20 rounded border-gray-300 focus:border-primary focus:ring-primary"
							/>
							<span class="ml-2 text-sm text-gray-600">seconds</span>
						</div>
						<div>
							<label for="delay-random" class="mb-1 block text-sm text-gray-600">
								Random variation in the delay before the agent answers each question:
							</label>
							<input
								id="delay-random"
								type="number"
								bind:value={delayBeforeAnswersRandom}
								min="0"
								class="w-20 rounded border-gray-300 focus:border-primary focus:ring-primary"
							/>
							<span class="ml-2 text-sm text-gray-600">seconds</span>
						</div>
					</div>
				</div>
			{/if}
			{#if data.models && data.models.length > 0}
				<div>
					<label for="answering-model" class="mb-1 block text-sm font-medium text-gray-700"
						>Language model</label
					>
					<select
						id="answering-model"
						bind:value={answeringModel}
						class="w-fit rounded border-gray-300 bg-white focus:border-primary focus:ring-primary"
					>
						{#each data.models as model (model)}
							<option value={model}>{model}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div>
				<label for="interview-language" class="mb-1 block text-sm font-medium text-gray-700"
					>Interview language</label
				>
				<select
					id="interview-language"
					bind:value={language}
					class="w-64 rounded border-gray-300 bg-white focus:border-primary focus:ring-primary"
				>
					{#each data.languages as langOption (langOption)}
						<option value={langOption.code}>{langOption.name}</option>
					{/each}
				</select>
			</div>

			<button
				onclick={runTest}
				disabled={running}
				class="mt-4 rounded bg-primary px-4 py-2 font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if running}
					<i class="fas fa-spinner fa-spin mr-2"></i> Running...
				{:else}
					Run test
				{/if}
			</button>
		</div>

		<h2 class="mt-8 mb-4 text-lg font-medium text-gray-800">Test Runs</h2>

		<DataTable
			{table}
			{columnLabels}
			{loading}
			{hasLoaded}
			selectable={false}
			rowLabel="test run"
			emptyTitle="No test runs yet"
			emptyDescription="Run the test above to create one."
		>
			{#snippet filters()}
				{#if table.getColumn('status')}
					<FacetedFilter title="Status" column={table.getColumn('status')!} />
				{/if}
			{/snippet}

			{#snippet cell(columnId, row)}
				{@const testRun = row.original}
				{#if columnId === 'created_at'}
					<span title={formatDateFull(testRun.created_at)}>
						{formatDate(testRun.created_at)}
					</span>
				{:else if columnId === 'language'}
					{testRun.language}
				{:else if columnId === 'n_interviews'}
					{testRun.n_interviews}
				{:else if columnId === 'question_model'}
					<span class="text-gray-300">&ndash;</span>
				{:else if columnId === 'answering_model'}
					{#if testRun.answering_model}{testRun.answering_model}{:else}<span class="text-gray-300"
							>&ndash;</span
						>{/if}
				{:else if columnId === 'status'}
					<span
						class="rounded-full px-2 py-0.5 text-xs font-semibold {getStatusClass(testRun.status)}"
					>
						{testRun.status}
					</span>
				{/if}
			{/snippet}
		</DataTable>
	</div>
	<SimulationActionBar current="runs" />
</div>
