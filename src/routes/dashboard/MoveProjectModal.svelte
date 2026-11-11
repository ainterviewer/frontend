<script lang="ts">
	import { untrack } from 'svelte';

	import type { FolderWithProjectsPublic, ProjectPublic } from '$lib/api';
	import Select from '$lib/components/Select.svelte';

	import DashboardModal, { labelClass } from './DashboardModal.svelte';

	interface Props {
		project: ProjectPublic;
		/** The folder the project is in now, left out of the choices. */
		sourceFolderId: string;
		/** The folders it may move to. */
		folders: FolderWithProjectsPublic[];
		/** Moves it; the page does, since a drag and drop moves projects too. */
		onMove: (targetFolderId: string) => void;
		onClose: () => void;
	}

	let { project, sourceFolderId, folders, onMove, onClose }: Props = $props();

	let items = $derived(
		folders.filter((f) => f.id !== sourceFolderId).map((f) => ({ value: f.id, label: f.title }))
	);
	// Seeded once: the modal is mounted afresh for each project it moves.
	let target = $state(untrack(() => items[0]?.value ?? ''));
</script>

<DashboardModal
	title="Move project"
	submitLabel="Move"
	canSubmit={!!target}
	onSubmit={() => onMove(target)}
	{onClose}
>
	{#snippet description()}
		Move "<span class="font-semibold text-gray-700">{project.title}</span>" to another folder.
	{/snippet}

	<div>
		<span class={labelClass}>Destination folder</span>
		<Select {items} bind:value={target} aria-label="Destination folder" />
	</div>
</DashboardModal>
