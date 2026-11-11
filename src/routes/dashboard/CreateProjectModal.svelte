<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Folders, type LanguageDict } from '$lib/api';
	import Select from '$lib/components/Select.svelte';
	import { toastApiError } from '$lib/utils/toast';

	import DashboardModal, { inputClass, labelClass } from './DashboardModal.svelte';

	interface Props {
		/** The folder the project is created in. */
		folderId: string;
		folderTitle: string;
		languages: LanguageDict[];
		onClose: () => void;
	}

	let { folderId, folderTitle, languages, onClose }: Props = $props();

	let name = $state('');
	let language = $state('EN');
	let languageItems = $derived(languages.map((l) => ({ value: l.code, label: l.name })));

	async function handleCreate() {
		const { error } = await Folders.createProject({
			path: { folder_id: folderId },
			body: { title: name.trim(), default_language: language }
		});
		if (error) {
			toastApiError(error, 'Failed to create project');
			return;
		}
		onClose();
		await invalidateAll();
	}
</script>

<DashboardModal
	title="New project"
	submitLabel="Create project"
	canSubmit={!!name.trim()}
	onSubmit={handleCreate}
	{onClose}
>
	{#snippet description()}
		In "<span class="font-semibold text-gray-700">{folderTitle}</span>".
	{/snippet}

	<div>
		<label class={labelClass} for="project-name">Project title</label>
		<input
			type="text"
			id="project-name"
			class={inputClass}
			bind:value={name}
			placeholder="Enter project title"
			required
		/>
	</div>

	<div>
		<span class={labelClass}>Language</span>
		<Select items={languageItems} bind:value={language} aria-label="Language" />
		<p class="mt-1.5 text-xs text-gray-500">The language the interview is held in by default.</p>
	</div>
</DashboardModal>
