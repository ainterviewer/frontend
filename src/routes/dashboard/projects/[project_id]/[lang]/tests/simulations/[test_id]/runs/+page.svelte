<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Synthesize } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import type { SynthesizeRequest } from '$lib/api/types.gen';
	import type { PageData } from './$types';
	import { auth } from '$lib/auth.svelte';

	let { data }: { data: PageData } = $props();

	let testRuns = $state<any[]>([]);
	let loading = $state(false);
	let running = $state(false);

	let nInterviews = $state(data.test.n_interviews ?? 1);
	let delayBeforeAnswers = $state(data.test.delay_before_answers?.[0] ?? 0);
	let delayBeforeAnswersRandom = $state(data.test.delay_before_answers?.[1] ?? 0);
	let answeringModel = $state(data.test.answering_model ?? '');
	let language = $state(data.test.language ?? page.params.lang);

	let refreshInterval: ReturnType<typeof setInterval>;

	const projectId = $derived(page.params.project_id);
	const lang = $derived(page.params.lang);
	const testId = $derived(page.params.test_id);
	const simulationsHref = $derived(
		resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations`)
	);

	async function loadTestRuns() {
		loading = true;
		const { data: statusData, error: statusError } = await Synthesize.getTestStatus({
			path: { project_id: projectId, test_id: testId }
		});
		if (statusError) {
			console.error('Failed to load test runs', statusError);
			testRuns = [];
		} else {
			testRuns = (statusData as any) || [];
		}
		loading = false;
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
			language: language as any,
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

	function formatDate(dateStr: string) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleString('en-GB', { hour12: false });
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
</script>

<a
	href={simulationsHref}
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
			max="5"
			class="w-20 rounded border-gray-300 focus:border-primary focus:ring-primary"
		/>
	</div>

	{#if auth.isAdmin}
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
				{#each data.models as model}
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
			{#each data.languages as langOption}
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

<div class="shrink-0 overflow-x-auto rounded-lg bg-white shadow">
	<table class="min-w-full leading-normal">
		<thead>
			<tr
				class="border-b-2 border-gray-200 bg-secondary text-left text-[13px] font-bold tracking-wider text-gray-900 uppercase"
			>
				<th class="w-12 px-5 py-3">
					<input type="checkbox" disabled class="form-checkbox h-4 w-4 text-primary opacity-50" />
				</th>
				<th class="px-5 py-3">Created</th>
				<th class="px-5 py-3">Language</th>
				<th class="px-5 py-3">N interviews</th>
				<th class="px-5 py-3">Question model</th>
				<th class="px-5 py-3">Answering model</th>
				<th class="px-5 py-3">Status</th>
				<th class="w-12 px-5 py-3"></th>
			</tr>
		</thead>
		<tbody class="bg-white">
			{#if loading}
				<tr>
					<td colspan="8" class="px-5 py-10 text-center text-gray-500">
						<i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading test runs...
					</td>
				</tr>
			{:else if testRuns.length === 0}
				<tr>
					<td colspan="8" class="px-5 py-10 text-center text-gray-500"> No test runs found </td>
				</tr>
			{:else}
				{#each testRuns as testRun (testRun.id)}
					<tr class="border-b border-gray-200 text-sm hover:bg-gray-50">
						<td class="px-5 py-4">
							<input
								type="checkbox"
								disabled
								class="form-checkbox h-4 w-4 cursor-not-allowed text-blue-600 opacity-50"
							/>
						</td>
						<td class="px-5 py-4">{formatDate(testRun.created_at)}</td>
						<td class="px-5 py-4">{testRun.language}</td>
						<td class="px-5 py-4">{testRun.n_interviews}</td>
						<td class="px-5 py-4">-</td>
						<td class="px-5 py-4">{testRun.answering_model || '-'}</td>
						<td class="px-5 py-4">
							<span
								class="rounded-full px-2 py-1 text-xs font-semibold {getStatusClass(
									testRun.status
								)}">{testRun.status}</span
							>
						</td>
						<td class="px-5 py-4"></td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
