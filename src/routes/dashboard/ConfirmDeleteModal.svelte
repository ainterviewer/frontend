<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toastApiError } from '$lib/utils/toast';

	import DashboardModal, { inputClass, labelClass } from './DashboardModal.svelte';

	interface Props {
		/** What is deleted, as in "Delete folder". */
		noun: 'folder' | 'project';
		/** Its title, which the user types to confirm. */
		name: string;
		/** The delete call; resolves to its error, if any. */
		remove: () => Promise<{ error?: unknown }>;
		onClose: () => void;
	}

	let { noun, name, remove, onClose }: Props = $props();

	let confirmation = $state('');

	async function handleDelete() {
		const { error } = await remove();
		if (error) {
			toastApiError(error, `Failed to delete ${noun}`);
			return;
		}
		onClose();
		await invalidateAll();
	}
</script>

<DashboardModal
	title="Delete {noun}"
	danger
	submitLabel="Delete {noun}"
	canSubmit={confirmation === name}
	onSubmit={handleDelete}
	{onClose}
>
	{#snippet description()}
		This permanently deletes "<span class="font-semibold text-gray-700">{name}</span>". It cannot be
		undone.
	{/snippet}

	<div>
		<label class={labelClass} for="confirm-delete-name">
			Type <span class="font-semibold text-gray-900">{name}</span> to confirm
		</label>
		<input
			type="text"
			id="confirm-delete-name"
			class={inputClass}
			autocomplete="off"
			bind:value={confirmation}
		/>
	</div>
</DashboardModal>
