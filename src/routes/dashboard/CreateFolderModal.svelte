<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { type CollaboratorRole, Folders } from '$lib/api';
	import { toastApiError } from '$lib/utils/toast';

	import CollaboratorEditor from './CollaboratorEditor.svelte';
	import DashboardModal, { inputClass, labelClass } from './DashboardModal.svelte';
	import { ROLE_ITEMS } from './folderAccess';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	type Row = { key: string; email: string; role: CollaboratorRole };

	let name = $state('');
	let collaborators: Row[] = $state([]);
	let draft = $state({ email: '', role: 'viewer' as CollaboratorRole });

	function add(email: string, role: CollaboratorRole): boolean {
		if (collaborators.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
			toast.error('That collaborator is already on the list');
			return false;
		}
		collaborators.push({ key: crypto.randomUUID(), email, role });
		return true;
	}

	async function handleCreate() {
		// Someone typed in but not added with + is meant to be added too.
		const pending = draft.email.trim();
		if (pending && !add(pending, draft.role)) return;
		draft = { email: '', role: 'viewer' };
		const { error } = await Folders.createFolder({
			body: {
				title: name.trim(),
				// The API only accepts the `folder_collaborations` alias, not `collaborators`.
				folder_collaborations: collaborators.map(({ email, role }) => ({ email, role }))
			}
		});
		if (error) {
			toastApiError(error, 'Failed to create folder');
			return;
		}
		onClose();
		await invalidateAll();
	}
</script>

<DashboardModal
	title="New folder"
	description="Group related projects. Everyone you add can open all of them."
	wide
	submitLabel="Create folder"
	canSubmit={!!name.trim()}
	onSubmit={handleCreate}
	{onClose}
>
	<div>
		<label class={labelClass} for="folder-name">Folder title</label>
		<input
			type="text"
			id="folder-name"
			class={inputClass}
			bind:value={name}
			placeholder="Enter folder title"
			required
		/>
	</div>

	<div>
		<div class="mb-2 flex items-baseline justify-between">
			<span class="text-sm font-medium text-gray-700">Collaborators</span>
			<span class="text-xs text-gray-400">Optional; you can add them later</span>
		</div>
		<CollaboratorEditor
			rows={collaborators}
			roleItems={ROLE_ITEMS}
			onRoleChange={(row, role) => (row.role = role)}
			onRemove={(row) => (collaborators = collaborators.filter((c) => c.key !== row.key))}
			onAdd={add}
			bind:draft
		/>
	</div>
</DashboardModal>
