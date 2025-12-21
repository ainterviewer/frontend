<script lang="ts">
	import { Projects } from '$lib/api';
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let project = $state(data.project);

	$effect(() => {
		project = data.project;
	});

	let title = $state(project.title);
	let defaultLanguage = $state(project.config.default_language);
	let savingTitle = $state(false);
	let savingLanguage = $state(false);
	let changingStatus = $state(false);

	async function saveTitle() {
		savingTitle = true;
		try {
			await Projects.changeProjectTitle({
				path: { project_id: project.id },
				body: { title }
			});
			await invalidateAll();
			alert('Title updated');
		} catch (e) {
			console.error(e);
			alert('Failed to update title');
		} finally {
			savingTitle = false;
		}
	}

	async function saveLanguage() {
		savingLanguage = true;
		try {
			await Projects.createInterviewConfig({
				path: { project_id: project.id },
				body: { default_language: defaultLanguage }
			});
			await invalidateAll();
			// Legacy showed a notification. We'll rely on the alert/toast system if we had one, for now alert.
			// Or maybe just silent success + invalidate is enough as the UI updates?
			// Legacy: showNotification("success", ...)
			alert('Default language updated');
		} catch (e) {
			console.error(e);
			alert('Failed to update language');
		} finally {
			savingLanguage = false;
		}
	}

	async function toggleStatus() {
		changingStatus = true;
		const newStatus = project.status === 'active' ? 'inactive' : 'active';
		try {
			await Projects.changeProjectStatus({
				path: { project_id: project.id },
				body: { status: newStatus }
			});
			await invalidateAll();
			alert(`Project status changed to ${newStatus}`);
		} catch (e) {
			console.error(e);
			alert('Failed to change status');
		} finally {
			changingStatus = false;
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h2 class="text-2xl font-semibold text-gray-800">Settings</h2>
</div>

<p class="mb-6 text-gray-600">Configure the general settings that are used in the interviews.</p>

<div class="space-y-8">
	<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6">
			<h3 class="mb-2 text-lg font-medium text-gray-800">General settings</h3>
		</div>

		<div class="space-y-6">
			<!-- Title -->
			<div>
				<label for="project-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label
				>
				<div class="flex gap-4">
					<input
						id="project-title"
						type="text"
						bind:value={title}
						class="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
					<button
						onclick={saveTitle}
						disabled={savingTitle}
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if savingTitle}
							Saving...
						{:else}
							Save
						{/if}
					</button>
				</div>
			</div>

			<!-- Language -->
			<div>
				<label for="default-language" class="mb-1 block text-sm font-medium text-gray-700"
					>Default Language</label
				>
				<div class="max-w-md">
					<select
						id="default-language"
						bind:value={defaultLanguage}
						onchange={saveLanguage}
						disabled={savingLanguage}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						{#each project.available_languages as language}
							<option value={language.code}>{language.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<hr class="border-gray-200" />

			<!-- Status -->
			<div>
				<h4 class="mb-2 text-sm font-medium text-gray-700">Status</h4>
				<div class="mb-4">
					The project is currently
					<span
						class="font-semibold uppercase"
						class:text-green-600={project.status === 'active'}
						class:text-red-600={project.status !== 'active'}
					>
						{project.status}
					</span>
				</div>
				<div>
					<button
						onclick={toggleStatus}
						disabled={changingStatus}
						class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Change status: {project.status === 'active' ? 'Inactive' : 'Active'}
					</button>
				</div>
			</div>
		</div>
	</section>
</div>
