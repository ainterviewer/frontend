<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		type CollaboratorInvitePublic,
		type CollaboratorRole,
		Folders,
		type FolderWithProjectsPublic
	} from '$lib/api';
	import { toastApiError } from '$lib/utils/toast';

	import CollaboratorEditor from './CollaboratorEditor.svelte';
	import DashboardModal from './DashboardModal.svelte';
	import { folderRoleOf, ROLE_ITEMS, roleAtMost } from './folderAccess';

	interface Props {
		folder: FolderWithProjectsPublic;
		onClose: () => void;
	}

	let { folder, onClose }: Props = $props();

	// Changes are staged locally and only sent when "Save Changes" is clicked,
	// so the whole modal behaves as one edit.
	// A row is a collaborator (`userId`), a pending invite (`invite`), or a new
	// email staged to be invited (neither). Adding someone always sends an
	// invite: they show as pending, whether or not they have an account, until
	// they accept the emailed link.
	type Row = {
		key: string;
		userId: string | null;
		invite: CollaboratorInvitePublic | null;
		email: string;
		role: CollaboratorRole;
		originalRole: CollaboratorRole | null;
	};

	function collaboratorRows(folder: FolderWithProjectsPublic): Row[] {
		return (folder.collaborators ?? []).map((collaborator) => ({
			key: collaborator.user.id,
			userId: collaborator.user.id,
			invite: null,
			email: collaborator.user.email,
			role: collaborator.role,
			originalRole: collaborator.role
		}));
	}

	function inviteRow(invite: CollaboratorInvitePublic): Row {
		return {
			key: invite.id,
			userId: null,
			invite,
			email: invite.email,
			role: invite.role,
			originalRole: invite.role
		};
	}

	// Seeded once: the modal is mounted afresh for each folder it edits.
	let rows: Row[] = $state(untrack(() => collaboratorRows(folder)));
	let invites: CollaboratorInvitePublic[] = $state([]);
	let draft = $state({ email: '', role: 'viewer' as CollaboratorRole });

	onMount(async () => {
		// Only editors may see a folder's invites; anyone else just sees none.
		const { data } = await Folders.getCollaboratorInvites({ path: { folder_id: folder.id } });
		if (data) {
			invites = data;
			rows.push(...data.map(inviteRow));
		}
	});

	// Nobody manages collaborators above their own role (only admins touch
	// admins). The API enforces it; this only keeps the dialog from offering it.
	let myRole = $derived(folderRoleOf(folder, page.data.user));
	let grantableRoleItems = $derived(
		ROLE_ITEMS.map((item) => ({ ...item, disabled: !roleAtMost(item.value, myRole) }))
	);
	function canManage(row: Row): boolean {
		return roleAtMost(row.originalRole ?? row.role, myRole);
	}

	function isExpired(invite: CollaboratorInvitePublic) {
		return new Date(invite.expires_at) < new Date();
	}

	// Staged changes, compared against the folder as it was loaded.
	let changes = $derived.by(() => {
		const original = folder.collaborators ?? [];
		const removed = original.filter((c) => !rows.some((r) => r.userId === c.user.id));
		const roleChanged = rows.filter((r) => r.userId && r.originalRole !== r.role);
		const revoked = invites.filter((invite) => !rows.some((r) => r.invite?.id === invite.id));
		// New emails, and pending invites whose role changed: both are (re)sent.
		const invited = rows.filter((r) => !r.userId && (!r.invite || r.originalRole !== r.role));
		return { removed, roleChanged, revoked, invited };
	});

	let hasChanges = $derived(Object.values(changes).some((list) => list.length > 0));

	async function resendInvite(row: Row) {
		if (!row.invite) return;
		const { data: invite, error } = await Folders.createCollaboratorInvite({
			path: { folder_id: folder.id },
			body: { email: row.email, role: row.invite.role }
		});
		if (error) {
			toastApiError(error, `Failed to resend the invitation to ${row.email}`);
			return;
		}
		invites = invites.map((i) => (i.id === invite.id ? invite : i));
		row.invite = invite;
		row.originalRole = invite.role;
		row.role = invite.role;
		toast.success(`Invitation resent to ${row.email}`);
	}

	function add(email: string, role: CollaboratorRole): boolean {
		if (rows.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
			toast.error('That collaborator is already on the list');
			return false;
		}
		rows.push({
			key: crypto.randomUUID(),
			userId: null,
			invite: null,
			email,
			role,
			originalRole: null
		});
		return true;
	}

	function remove(row: Row) {
		rows = rows.filter((r) => r.key !== row.key);
	}

	/** Runs one change; on failure says so and reloads, since the earlier ones went through. */
	async function apply(call: Promise<{ error?: unknown }>, failure: string): Promise<boolean> {
		const { error } = await call;
		if (!error) return true;
		toastApiError(error, failure);
		await invalidateAll();
		return false;
	}

	async function handleSave() {
		// Someone typed in but not added with + is meant to be added too.
		const pending = draft.email.trim();
		if (pending && !add(pending, draft.role)) return;
		draft = { email: '', role: 'viewer' };
		const folder_id = folder.id;
		const { removed, roleChanged, revoked, invited } = changes;

		for (const c of removed) {
			const call = Folders.removeCollaborator({
				path: { folder_id },
				query: { user_id: c.user.id }
			});
			if (!(await apply(call, `Failed to remove ${c.user.email}`))) return;
		}
		for (const c of roleChanged) {
			const call = Folders.updateCollaboratorRole({
				path: { folder_id },
				query: { user_id: c.userId!, role: c.role }
			});
			if (!(await apply(call, `Failed to update the role of ${c.email}`))) return;
		}
		for (const invite of revoked) {
			const call = Folders.deleteCollaboratorInvite({
				path: { folder_id, invite_id: invite.id }
			});
			if (!(await apply(call, `Failed to revoke the invitation to ${invite.email}`))) return;
		}
		for (const c of invited) {
			const call = Folders.createCollaboratorInvite({
				path: { folder_id },
				body: { email: c.email, role: c.role }
			});
			if (!(await apply(call, `Failed to invite ${c.email}`))) return;
		}
		if (invited.length > 0) {
			toast.success(
				invited.length === 1
					? `Invitation sent to ${invited[0].email}`
					: `${invited.length} invitations sent`
			);
		}

		onClose();
		await invalidateAll();
	}
</script>

<DashboardModal
	title="Collaborators"
	wide
	submitLabel="Save changes"
	canSubmit={hasChanges || !!draft.email.trim()}
	onSubmit={handleSave}
	{onClose}
>
	{#snippet description()}
		Everyone here can open every project in "<span class="font-semibold text-gray-700"
			>{folder.title}</span
		>", with their role's permissions. People you add get an emailed invitation and join once they
		accept it.
	{/snippet}

	<CollaboratorEditor
		{rows}
		roleItems={grantableRoleItems}
		{canManage}
		onRoleChange={(row, role) => (row.role = role)}
		onRemove={remove}
		onAdd={add}
		bind:draft
		removeLabel={(row) => (row.invite ? 'Revoke invitation' : 'Remove collaborator')}
	>
		{#snippet note(row)}
			{#if row.invite}
				{#if isExpired(row.invite)}
					<span class="text-red-600">Invitation expired</span>
				{:else}
					Invitation pending
				{/if}
				{#if canManage(row)}
					·
					<button
						type="button"
						class="cursor-pointer text-primary underline underline-offset-2 hover:no-underline"
						onclick={() => resendInvite(row)}>Resend</button
					>
				{/if}
			{:else if !row.userId}
				Invited when you save
			{:else if row.originalRole !== row.role}
				Role changes when you save
			{/if}
		{/snippet}
	</CollaboratorEditor>
</DashboardModal>
