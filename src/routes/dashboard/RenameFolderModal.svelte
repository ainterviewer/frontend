<script lang="ts">
	import { untrack } from 'svelte';

	import { invalidateAll } from '$app/navigation';
	import { Folders, type FolderWithProjectsPublic } from '$lib/api';
	import { toastApiError } from '$lib/utils/toast';

	import DashboardModal, { inputClass, labelClass } from './DashboardModal.svelte';

	interface Props {
		folder: FolderWithProjectsPublic;
		onClose: () => void;
	}

	let { folder, onClose }: Props = $props();

	// Seeded once: the modal is mounted afresh for each folder it renames.
	let name = $state(untrack(() => folder.title));
	let title = $derived(name.trim());

	async function handleRename() {
		const { error } = await Folders.editFolder({
			path: { folder_id: folder.id },
			body: { title }
		});
		if (error) {
			toastApiError(error, 'Failed to rename folder');
			return;
		}
		onClose();
		await invalidateAll();
	}
</script>

<DashboardModal
	title="Rename folder"
	submitLabel="Rename"
	canSubmit={!!title && title !== folder.title}
	onSubmit={handleRename}
	{onClose}
>
	{#snippet description()}
		Give "<span class="font-semibold text-gray-700">{folder.title}</span>" a new name.
	{/snippet}

	<div>
		<label class={labelClass} for="rename-folder-name">Folder title</label>
		<input
			type="text"
			id="rename-folder-name"
			class={inputClass}
			bind:value={name}
			placeholder="Enter folder title"
			required
		/>
	</div>
</DashboardModal>
