<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Projects } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

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
		const { error } = await Projects.changeProjectTitle({
			path: { project_id: project.id },
			body: { title }
		});
		if (error) {
			console.error(error);
			toast.error('Failed to update title');
		} else {
			await invalidateAll();
			toast.success('Title updated');
		}
		savingTitle = false;
	}

	async function saveLanguage() {
		savingLanguage = true;
		const { error } = await Projects.createInterviewConfig({
			path: { project_id: project.id },
			body: { default_language: defaultLanguage }
		});
		if (error) {
			console.error(error);
			toast.error('Failed to update language');
		} else {
			await invalidateAll();
			toast.success('Default language updated');
		}
		savingLanguage = false;
	}

	async function toggleStatus() {
		changingStatus = true;
		const newStatus = project.status === 'active' ? 'inactive' : 'active';
		const { error } = await Projects.changeProjectStatus({
			path: { project_id: project.id },
			body: { status: newStatus }
		});
		if (error) {
			console.error(error);
			toast.error('Failed to change status');
		} else {
			await invalidateAll();
			toast.success(`Project status changed to ${newStatus}`);
		}
		changingStatus = false;
	}
</script>

<h1 class="page-title">Settings</h1>

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
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
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
