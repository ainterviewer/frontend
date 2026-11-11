<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { Folders, type FolderWithProjectsPublic } from '$lib/api';
	import { toastApiError } from '$lib/utils/toast';

	import DashboardModal from './DashboardModal.svelte';

	interface Props {
		folder: FolderWithProjectsPublic;
		onClose: () => void;
	}

	let { folder, onClose }: Props = $props();

	async function handleLeave() {
		const { error } = await Folders.leaveFolder({ path: { folder_id: folder.id } });
		if (error) {
			// The only admin is refused (`last_admin`); the message says why.
			toastApiError(error, 'Failed to leave folder');
			return;
		}
		const { title } = folder;
		onClose();
		await invalidateAll();
		toast.success(`You left "${title}"`);
	}
</script>

<DashboardModal
	title="Leave folder"
	danger
	submitLabel="Leave folder"
	onSubmit={handleLeave}
	{onClose}
>
	{#snippet description()}
		Leave "<span class="font-semibold text-gray-700">{folder.title}</span>"?
	{/snippet}

	<p class="text-sm text-gray-600">
		You will lose access to its projects until someone invites you again. The folder and its
		projects stay as they are.
	</p>
</DashboardModal>
