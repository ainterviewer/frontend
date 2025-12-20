<script lang="ts">
	import { page } from '$app/state';
	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import { client } from '$lib/api/client.gen';

	let tests: TestSetupPublic[] = $state([]);
	let selectedTests = $state(new Set<string>());
	let sortBy = $state('created_at');
	let sortDesc = $state(true);
	let projectId = $derived(page.params.project_id);

	// Modal state
	let isModalOpen = $state(false);
	let newTestName = $state('');
	let newTestType = $state('shuffled_ai');
	let isCreating = $state(false);

	async function loadTests() {
		if (!projectId) return;
		try {
			const response = await Synthesize.getTestSetups({
				path: { project_id: projectId }
			});
			if (response.data) {
				tests = response.data;
				sortTests();
			}
		} catch (e) {
			console.error('Failed to load tests', e);
		}
	}

	function sortTests() {
		tests = [...tests].sort((a: any, b: any) => {
			let valA = a[sortBy];
			let valB = b[sortBy];
			if (sortBy === 'created_at' || sortBy === 'last_updated') {
				valA = new Date(valA || 0).getTime();
				valB = new Date(valB || 0).getTime();
			}
			if (valA < valB) return sortDesc ? 1 : -1;
			if (valA > valB) return sortDesc ? -1 : 1;
			return 0;
		});
	}

	function handleSort(column: string) {
		if (sortBy === column) {
			sortDesc = !sortDesc;
		} else {
			sortBy = column;
			sortDesc = true;
		}
		sortTests();
	}

	async function deleteTests(ids: string[]) {
		if (!projectId) return;
		if (
			!confirm(
				`Are you sure you want to delete ${ids.length} test(s)?\n\nThis action cannot be undone.`
			)
		)
			return;

		try {
			await client.delete({
				url: `/api/projects/${projectId}/tests`,
				body: { test_ids: ids },
				headers: { 'Content-Type': 'application/json' }
			});
			selectedTests.clear();
			selectedTests = new Set(selectedTests);
			loadTests();
		} catch (e) {
			console.error('Failed to delete tests', e);
			alert('Failed to delete tests');
		}
	}

	async function createTest() {
		if (!projectId) return;
		isCreating = true;
		try {
			const response = await Synthesize.createTestSetup({
				body: {
					name: newTestName,
					type: newTestType as any,
					project_id: projectId
				}
			});
			isModalOpen = false;
			newTestName = '';
			loadTests();
		} catch (e) {
			console.error('Failed to create test', e);
			alert('Failed to create test');
		} finally {
			isCreating = false;
		}
	}

	$effect(() => {
		if (projectId) {
			loadTests();
		}
	});

	function navigateToTest(test: TestSetupPublic) {
		window.location.href = `/dashboard/projects/${projectId}/${page.params.lang}/tests/${test.id}/setup`;
	}
</script>

<div class="flex justify-between">
	<h1 class="relative inline-block text-2xl font-bold">Tests</h1>
	<div class="flex gap-2">
		<button
			class="hover:bg-sondary flex h-10 w-10 items-center justify-center rounded-full bg-secondary shadow transition-colors hover:brightness-95"
			title="Create new test"
			onclick={() => (isModalOpen = true)}
		>
			<i class="fa-solid fa-plus"></i>
		</button>
	</div>
</div>
<p>
	Create different test setups to help you develop your interview guide. Select one of the three
	test types, fill in the required information, and run any number of synthetic interviews.
</p>

<div class="my-6 flex flex-row justify-start gap-5">
	<div class="w-full rounded-xl p-4 shadow-md">
		<i class="fa-solid fa-robot" title="Shuffled AI Respondents"></i>
		<h3 class="mb-2 text-lg">Shuffled AI Respondents</h3>
		<p>
			Specify different background characteristics, which our system then shuffles automatically to
			generate.
		</p>
	</div>
	<div class="w-full rounded-xl p-4 shadow-md">
		<i class="fa-solid fa-user-pen" title="Fixed AI Respondents"></i>
		<h3 class="mb-2 text-lg">Fixed AI Personas</h3>
		<p>
			Define different personas based on our template, which will then be used to generate the
			answers.
		</p>
	</div>
	<div class="w-full rounded-xl p-4 shadow-md">
		<i class="fa-solid fa-file-pen" title="Fixed answers"></i>
		<h3 class="mb-2 text-lg">Fixed Answers</h3>
		<p>
			Write predefined answers to every main question, the system then automatically generates
			follow up questions where relevant
		</p>
	</div>
</div>

<h2 class="text-lg font-bold">Setups</h2>

<div class="overflow-hidden rounded-lg bg-white shadow">
	<table class="w-full border-collapse text-left">
		<thead class="border-b border-gray-200 bg-gray-50">
			<tr>
				<th class="w-[50px] p-3"></th>
				<th
					class="w-[200px] cursor-pointer p-3 transition-colors select-none hover:bg-gray-100"
					onclick={() => handleSort('type')}
					>Type {sortBy === 'type' ? (sortDesc ? '▼' : '▲') : ''}</th
				>
				<th
					class="cursor-pointer p-3 transition-colors select-none hover:bg-gray-100"
					onclick={() => handleSort('name')}
					>Name {sortBy === 'name' ? (sortDesc ? '▼' : '▲') : ''}</th
				>
				<th
					class="w-[250px] cursor-pointer p-3 transition-colors select-none hover:bg-gray-100"
					onclick={() => handleSort('created_at')}
					>Created {sortBy === 'created_at' ? (sortDesc ? '▼' : '▲') : ''}</th
				>
				<th
					class="w-[250px] cursor-pointer p-3 transition-colors select-none hover:bg-gray-100"
					onclick={() => handleSort('last_updated')}
					>Updated {sortBy === 'last_updated' ? (sortDesc ? '▼' : '▲') : ''}</th
				>
				<th class="w-[50px] p-3"></th>
			</tr>
		</thead>
		<tbody>
			{#each tests as test (test.id)}
				<tr
					class="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
					role="button"
					onclick={(e) => {
						if (
							(e.target as HTMLElement).tagName !== 'INPUT' &&
							!(e.target as HTMLElement).closest('button')
						) {
							navigateToTest(test);
						}
					}}
				>
					<td class="p-3 text-center text-gray-800">
						{#if test.type === 'shuffled_ai'}
							<i class="fa-solid fa-robot" title="Shuffled AI Respondents"></i>
						{:else if test.type === 'fixed_ai'}
							<i class="fa-solid fa-user-pen" title="Fixed AI Respondents"></i>
						{:else}
							<i class="fa-solid fa-file-pen" title="Fixed answers"></i>
						{/if}
					</td>
					<td class="p-3">{test.type.replace('_', ' ')}</td>
					<td class="p-3 font-medium">{test.name}</td>
					<td class="p-3 text-sm text-gray-500">{new Date(test.created_at).toLocaleString()}</td>
					<td class="p-3 text-sm text-gray-500"
						>{test.last_updated ? new Date(test.last_updated).toLocaleString() : 'N/A'}</td
					>
					<td class="p-3 text-right">
						<button
							class="ml-1 rounded p-2 text-gray-400 hover:bg-gray-200 hover:text-red-600"
							onclick={(e) => {
								e.stopPropagation();
								deleteTests([test.id]);
							}}
							title="Delete"
						>
							<i class="fa-solid fa-trash-can"></i>
						</button>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="p-8 text-center text-gray-500"
						>No tests found. Create one to get started.</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if isModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			class="w-full max-w-md animate-[scale-in_0.2s_ease-out] overflow-hidden rounded-lg bg-white shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
				<h3 class="text-lg font-bold">Create New Test</h3>
				<button
					onclick={() => (isModalOpen = false)}
					class="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600"
					aria-label="Close"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>
			<div class="space-y-4 p-6">
				<div>
					<label for="test-name" class="mb-1 block font-medium text-gray-700">Test title</label>
					<input
						type="text"
						id="test-name"
						bind:value={newTestName}
						class="w-full rounded border-gray-300 focus:border-primary focus:ring-primary"
						placeholder="My Test"
					/>
				</div>

				<fieldset>
					<legend class="mb-2 block font-medium text-gray-700">Test type</legend>
					<div class="space-y-2">
						<label
							class="flex cursor-pointer items-center gap-2 rounded border border-transparent p-2 hover:border-gray-200 hover:bg-gray-50"
						>
							<input
								type="radio"
								name="test-type"
								value="shuffled_ai"
								bind:group={newTestType}
								class="text-primary focus:ring-primary"
							/>
							<span>Shuffled AI Respondents</span>
						</label>
						<label class="flex cursor-not-allowed items-center gap-2 p-2 opacity-50">
							<input
								type="radio"
								name="test-type"
								value="fixed_ai"
								disabled
								class="text-primary focus:ring-primary"
							/>
							<span>Fixed AI Respondents</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-2 rounded border border-transparent p-2 hover:border-gray-200 hover:bg-gray-50"
						>
							<input
								type="radio"
								name="test-type"
								value="fixed_answers"
								bind:group={newTestType}
								class="text-primary focus:ring-primary"
							/>
							<span>Fixed answers</span>
						</label>
					</div>
				</fieldset>
			</div>
			<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 p-4">
				<button
					onclick={() => (isModalOpen = false)}
					class="rounded px-4 py-2 font-medium text-gray-700 hover:bg-gray-200">Cancel</button
				>
				<button
					onclick={createTest}
					disabled={!newTestName || isCreating}
					class="rounded bg-primary px-4 py-2 font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isCreating ? 'Creating...' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}
