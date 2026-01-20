<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Synthesize } from '$lib/api';
	import Info from '$lib/components/Info.svelte';

	let { data } = $props();

	let sortBy = $state('created_at');
	let sortDesc = $state(true);
	let projectId = $derived(page.params.project_id);
	let lang = $derived(page.params.lang);

	let tests = $derived.by(() => {
		return [...data.tests].sort((a: any, b: any) => {
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
	});

	// Modal state
	let isModalOpen = $state(false);
	let newTestName = $state('');
	let newTestType = $state('shuffled_ai');
	let isCreating = $state(false);

	// Dropdown state
	let activeDropdown: string | null = $state(null);

	const testTypes = [
		{
			type: 'fixed_answers',
			label: 'Fixed Answers',
			icon: 'fa-file-pen',
			description:
				'Write predefined answers to every main question, the system then automatically generates follow up questions where relevant'
		},
		{
			type: 'fixed_ai',
			label: 'Fixed AI Personas',
			icon: 'fa-user-pen',
			description:
				'Define different personas based on our template, which will then be used to generate the answers.'
		},
		{
			type: 'shuffled_ai',
			label: 'Shuffled AI Respondents',
			icon: 'fa-robot',
			description:
				'Specify different background characteristics, which our system then shuffles automatically to generate.'
		}
	];

	async function deleteTest(testId: string) {
		if (!projectId) return;
		if (!confirm(`Are you sure you want to delete the test?\n\nThis action cannot be undone.`))
			return;

		try {
			await Synthesize.deleteTestSetup({
				path: {
					project_id: projectId,
					test_id: testId
				},
				headers: { 'Content-Type': 'application/json' }
			});
			await invalidateAll();
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
			await invalidateAll();
		} catch (e) {
			console.error('Failed to create test', e);
			alert('Failed to create test');
		} finally {
			isCreating = false;
		}
	}

	function toggleDropdown(e: MouseEvent, id: string) {
		e.stopPropagation();
		activeDropdown = activeDropdown === id ? null : id;
	}

	function closeDropdowns() {
		activeDropdown = null;
	}

	$effect(() => {
		window.addEventListener('click', closeDropdowns);
		return () => window.removeEventListener('click', closeDropdowns);
	});
</script>

<div class="flex justify-between">
	<h1 class="relative inline-block text-2xl font-bold">Simulations</h1>
</div>
<p>
	Create different test setups to help you develop your interview guide. Select one of the three
	test types, fill in the required information, and run any number of synthetic interviews.
</p>

{#each testTypes as typeInfo}
	<div class="relative mt-4 mb-4 flex items-center gap-2 border-t-2 border-primary pt-6">
		<i class="fas {typeInfo.icon} text-4xl text-dark"></i>
		<h2 class="text-lg">{typeInfo.label}</h2>
		<Info text={typeInfo.description} />
	</div>

	<div class="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each tests.filter((t) => t.type === typeInfo.type) as test (test.id)}
			<div class="flex flex-col rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg">
				<div class="grow p-4">
					<div class="flex">
						<h3 class="mb-1 w-full text-lg font-semibold">{test.name}</h3>
						<div class="dropdown-container relative">
							<button
								class="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
								onclick={(e) => toggleDropdown(e, test.id)}
								aria-label="Test actions"
							>
								<i class="fa-solid fa-ellipsis-vertical"></i>
							</button>
							{#if activeDropdown === test.id}
								<div class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg">
									<button
										class="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
										onclick={() => deleteTest(test.id)}
									>
										Delete
									</button>
								</div>
							{/if}
						</div>
					</div>

					<div class="flex flex-col gap-1 text-sm text-gray-500">
						<p>
							Created: {new Date(test.created_at).toLocaleDateString('en-GB')}
						</p>
						<p>
							Updated: {test.last_updated
								? new Date(test.last_updated).toLocaleDateString('en-GB', {
										hour: '2-digit',
										minute: '2-digit'
									})
								: 'N/A'}
						</p>
					</div>
				</div>
				<div class="flex items-center justify-between border-t border-gray-200">
					<a
						href={resolve(
							`/dashboard/projects/${projectId}/${lang}/tests/simulations/${test.id}/setup`
						)}
						class="flex-1 border-r border-gray-200 py-2 text-center font-medium text-primary hover:bg-gray-50"
					>
						Setup
					</a>
					<a
						href={resolve(
							`/dashboard/projects/${projectId}/${lang}/tests/simulations/${test.id}/runs`
						)}
						class="flex-1 py-2 text-center font-medium text-primary hover:bg-gray-50"
					>
						Runs
					</a>
				</div>
			</div>
		{/each}

		<div
			class="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
			role="button"
			tabindex="0"
			onclick={() => {
				newTestType = typeInfo.type;
				isModalOpen = true;
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					newTestType = typeInfo.type;
					isModalOpen = true;
				}
			}}
		>
			<i class="fa-solid fa-plus mr-2 text-xl"></i>
			New Test
		</div>
	</div>
{/each}

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
