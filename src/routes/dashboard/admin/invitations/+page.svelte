<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type {
		InvitationCreate,
		InvitationPublic,
		InvitationUpdate,
		Scope,
		TimeDelta
	} from '$lib/api';
	import { Admin } from '$lib/api/sdk.gen';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		formatDate,
		formatDateFull,
		matchesSelection,
		NO_PAGINATION,
		sortableText,
		sortableTime,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { errorMessage } from '$lib/utils/errors';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let invitations = $derived(data.invitations as InvitationPublic[]);
	let isLoading = $state(false);
	let error = $derived<string | null>(data.error);
	let showCreateForm = $state(false);
	let editingInvitation = $state<InvitationPublic | null>(null);

	// Create form fields
	let newTitle = $state('');
	let newEmail = $state('');
	let newExpiresAt = $state('');
	let newReuseable = $state(true);
	let newUserScope = $state<Scope>('user');
	let newUserExpires = $state('');
	let userExpiresMode = $state<'absolute' | 'relative'>('relative');
	let newUserExpiresDays = $state(0);
	let newUserExpiresHours = $state(0);
	let newUserExpiresMinutes = $state(0);

	let reusableInvitations = $derived(invitations.filter((invitation) => invitation.reuseable));
	let singleUseInvitations = $derived(invitations.filter((invitation) => !invitation.reuseable));

	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800',
		user: 'bg-blue-100 text-blue-800',
		demo: 'bg-amber-100 text-amber-800',
		guest: 'bg-gray-100 text-gray-800'
	};

	async function loadInvitations() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
			clearSelections();
		} catch (e) {
			error = errorMessage(e) || 'Failed to fetch invitations';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Each table owns its own selection, so the ids come from the table whose
	 * Delete was clicked -- the two lists are never acted on together.
	 */
	async function handleDelete(ids: string[]) {
		if (ids.length === 0) return;

		if (!confirm(`Are you sure you want to delete ${ids.length} invitation(s)?`)) {
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.deleteInvitations({
				body: { ids }
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			isLoading = false;
			await loadInvitations();
			toast.success('Invitations deleted');
		} catch (e) {
			error = `Failed to delete invitations: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}

	async function handleCreate() {
		isLoading = true;
		try {
			let userExpires: string | TimeDelta | null = null;
			if (userExpiresMode === 'absolute' && newUserExpires) {
				userExpires = new Date(newUserExpires).toISOString();
			} else if (userExpiresMode === 'relative') {
				const hasDuration =
					newUserExpiresDays > 0 || newUserExpiresHours > 0 || newUserExpiresMinutes > 0;
				if (hasDuration) {
					userExpires = {
						days: newUserExpiresDays || undefined,
						hours: newUserExpiresHours || undefined,
						minutes: newUserExpiresMinutes || undefined
					};
				}
			}

			const body: InvitationCreate = {
				expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
				reuseable: newReuseable,
				user_scope: newUserScope,
				title: newTitle || null,
				user_expires: userExpires
			};

			const response = await Admin.createInvitation({ body });
			if (response.error) {
				throw new Error(String(response.error));
			}
			isLoading = false;
			showCreateForm = false;
			resetForm();
			await loadInvitations();
			toast.success('Invitation created');
		} catch (e) {
			error = `Failed to create invitation: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}

	function resetForm() {
		newTitle = '';
		newEmail = '';
		newExpiresAt = '';
		newReuseable = true;
		newUserScope = 'user';
		newUserExpires = '';
		userExpiresMode = 'relative';
		newUserExpiresDays = 0;
		newUserExpiresHours = 0;
		newUserExpiresMinutes = 0;
		editingInvitation = null;
	}

	function startEdit(invitation: InvitationPublic) {
		editingInvitation = invitation;
		newTitle = invitation.title ?? '';
		newEmail = invitation.email ?? '';
		newReuseable = invitation.reuseable ?? true;
		newUserScope = invitation.user_scope ?? 'user';

		if (invitation.expires_at) {
			const d = new Date(invitation.expires_at);
			newExpiresAt = d.toISOString().slice(0, 16);
		} else {
			newExpiresAt = '';
		}

		if (!invitation.user_expires) {
			userExpiresMode = 'relative';
			newUserExpires = '';
			newUserExpiresDays = 0;
			newUserExpiresHours = 0;
			newUserExpiresMinutes = 0;
		} else if (typeof invitation.user_expires === 'string') {
			userExpiresMode = 'absolute';
			const d = new Date(invitation.user_expires);
			newUserExpires = d.toISOString().slice(0, 16);
			newUserExpiresDays = 0;
			newUserExpiresHours = 0;
			newUserExpiresMinutes = 0;
		} else {
			userExpiresMode = 'relative';
			newUserExpires = '';
			newUserExpiresDays = invitation.user_expires.days ?? 0;
			newUserExpiresHours = invitation.user_expires.hours ?? 0;
			newUserExpiresMinutes = invitation.user_expires.minutes ?? 0;
		}

		showCreateForm = true;
	}

	async function handleUpdate() {
		if (!editingInvitation) return;
		isLoading = true;
		try {
			let userExpires: string | TimeDelta | null = null;
			if (userExpiresMode === 'absolute' && newUserExpires) {
				userExpires = new Date(newUserExpires).toISOString();
			} else if (userExpiresMode === 'relative') {
				const hasDuration =
					newUserExpiresDays > 0 || newUserExpiresHours > 0 || newUserExpiresMinutes > 0;
				if (hasDuration) {
					userExpires = {
						days: newUserExpiresDays || undefined,
						hours: newUserExpiresHours || undefined,
						minutes: newUserExpiresMinutes || undefined
					};
				}
			}

			const body: InvitationUpdate = {
				expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
				reuseable: newReuseable,
				user_scope: newUserScope,
				title: newTitle || null,
				user_expires: userExpires,
				email: !newReuseable ? newEmail || null : undefined
			};

			const response = await Admin.updateInvitation({
				path: { invitation_id: editingInvitation.id },
				body
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			isLoading = false;
			showCreateForm = false;
			resetForm();
			await loadInvitations();
			toast.success('Invitation updated');
		} catch (e) {
			error = `Failed to update invitation: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}

	async function copyLink(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			toast.success('Link copied to clipboard');
		} catch {
			toast.error('Failed to copy link');
		}
	}

	/* ---------------------------------------------------------------- tables */

	const helper = createColumnHelper<DataTableFeatures, InvitationPublic>();

	/** Renders a TimeDelta or an absolute timestamp as a short label. */
	function userExpiresLabel(value: InvitationPublic['user_expires']): string {
		if (!value) return '';
		if (typeof value === 'string') return formatDate(value);
		const delta = value as TimeDelta;
		return (
			[
				delta.days ? `${delta.days}d` : '',
				delta.hours ? `${delta.hours}h` : '',
				delta.minutes ? `${delta.minutes}m` : ''
			]
				.filter(Boolean)
				.join(' ') || ''
		);
	}

	const isPast = (value: string | null | undefined) => !!value && new Date(value) < new Date();

	const sharedColumns = [
		helper.accessor((i) => sortableText(i.user_scope ?? 'user'), {
			id: 'user_scope',
			header: 'Scope',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor((i) => sortableTime(i.expires_at), {
			id: 'expires_at',
			header: 'Expires at',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums' }
		}),
		helper.accessor((i) => sortableText(userExpiresLabel(i.user_expires)), {
			id: 'user_expires',
			header: 'User expires',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap' }
		}),
		helper.display({
			id: 'actions',
			header: 'Actions',
			enableHiding: false,
			meta: { align: 'right', class: 'whitespace-nowrap' }
		})
	];

	const titleColumn = helper.accessor((i) => sortableText(i.title), {
		id: 'title',
		header: 'Title',
		sortFn: 'text',
		sortUndefined: 'last',
		meta: { class: 'font-medium whitespace-nowrap text-dark' }
	});

	const emailColumn = helper.accessor((i) => sortableText(i.email), {
		id: 'email',
		header: 'Email',
		sortFn: 'text',
		sortUndefined: 'last',
		meta: { class: 'whitespace-nowrap text-gray-700' }
	});

	const columnLabels: Record<string, string> = {
		title: 'Title',
		email: 'Email',
		user_scope: 'Scope',
		expires_at: 'Expires at',
		user_expires: 'User expires'
	};

	const searchable = ['title', 'email'];

	const reusableTable = createTable({
		features: dataTableFeatures,
		columns: helper.columns([
			helper.display({ id: 'select', enableHiding: false }),
			titleColumn,
			...sharedColumns
		]),
		get data() {
			return reusableInvitations;
		},
		getRowId: (i) => i.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchable.includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'title', desc: false }] }
	});

	const singleUseTable = createTable({
		features: dataTableFeatures,
		columns: helper.columns([
			helper.display({ id: 'select', enableHiding: false }),
			titleColumn,
			emailColumn,
			...sharedColumns
		]),
		get data() {
			return singleUseInvitations;
		},
		getRowId: (i) => i.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchable.includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'title', desc: false }] }
	});

	// Delete acts on both tables at once, as the single toolbar button did.
	function clearSelections() {
		reusableTable.resetRowSelection(true);
		singleUseTable.resetRowSelection(true);
	}
</script>

<svelte:head>
	<title>AInterviewer - Invitations</title>
</svelte:head>

<div class="mb-4 flex items-end justify-between">
	<h2 class="page-title">Invitations</h2>
	<div class="flex gap-2">
		<button
			class="cursor-pointer rounded bg-green-600 p-2 text-white transition hover:bg-green-700 disabled:opacity-50"
			onclick={() => {
				if (showCreateForm) {
					showCreateForm = false;
					resetForm();
				} else {
					resetForm();
					showCreateForm = true;
				}
			}}
			title="Create new invitation"
			disabled={isLoading}
		>
			<i class="fa-solid fa-plus"></i>
		</button>
		<button
			class="cursor-pointer rounded bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
			onclick={loadInvitations}
			title="Refresh invitations"
			disabled={isLoading}
		>
			<i class="fa-solid fa-arrows-rotate {isLoading ? 'animate-spin' : ''}"></i>
		</button>
	</div>
</div>

{#if error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<strong class="font-bold">Error:</strong>
		<span class="block sm:inline">{error}</span>
	</div>
{/if}

{#if showCreateForm}
	<div class="mb-4 rounded-lg bg-white p-6 shadow-md">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">
			{editingInvitation ? 'Edit Invitation' : 'Create Invitation'}
		</h3>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (editingInvitation) handleUpdate();
				else handleCreate();
			}}
			class="grid grid-cols-1 gap-4 sm:grid-cols-2"
		>
			<div>
				<label for="title" class="block text-sm font-medium text-gray-700">Title</label>
				<input
					id="title"
					type="text"
					bind:value={newTitle}
					placeholder="Optional title"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
				/>
			</div>
			{#if editingInvitation && !editingInvitation.reuseable}
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						id="email"
						type="email"
						bind:value={newEmail}
						placeholder="Optional email"
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
					/>
				</div>
			{/if}
			<div>
				<label for="expires_at" class="block text-sm font-medium text-gray-700">Expires At</label>
				<input
					id="expires_at"
					type="datetime-local"
					bind:value={newExpiresAt}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
				/>
			</div>
			<div>
				<label for="user_scope" class="block text-sm font-medium text-gray-700">User Scope</label>
				<select
					id="user_scope"
					bind:value={newUserScope}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
				>
					<option value="admin">Admin</option>
					<option value="user">User</option>
					<option value="demo">Demo</option>
					<option value="guest">Guest</option>
				</select>
			</div>
			<div class="sm:col-span-2">
				<div class="mb-2 flex items-center gap-3">
					<span class="block text-sm font-medium text-gray-700">User Expires</span>
					<div class="flex rounded-md border border-gray-300 text-xs">
						<button
							type="button"
							class="cursor-pointer rounded-l-md px-2 py-1 transition {userExpiresMode ===
							'relative'
								? 'bg-primary text-white'
								: 'bg-white text-gray-600 hover:bg-gray-50'}"
							onclick={() => (userExpiresMode = 'relative')}
						>
							Duration
						</button>
						<button
							type="button"
							class="cursor-pointer rounded-r-md px-2 py-1 transition {userExpiresMode ===
							'absolute'
								? 'bg-primary text-white'
								: 'bg-white text-gray-600 hover:bg-gray-50'}"
							onclick={() => (userExpiresMode = 'absolute')}
						>
							Date
						</button>
					</div>
				</div>
				{#if userExpiresMode === 'absolute'}
					<input
						id="user_expires"
						type="datetime-local"
						bind:value={newUserExpires}
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
					/>
				{:else}
					<div class="mt-1 flex gap-3">
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="0"
								bind:value={newUserExpiresDays}
								class="w-20 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
							<span class="text-sm text-gray-500">days</span>
						</div>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="0"
								max="23"
								bind:value={newUserExpiresHours}
								class="w-20 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
							<span class="text-sm text-gray-500">hours</span>
						</div>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="0"
								max="59"
								bind:value={newUserExpiresMinutes}
								class="w-20 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
							<span class="text-sm text-gray-500">min</span>
						</div>
					</div>
				{/if}
			</div>
			<div class="flex items-center sm:col-span-2">
				<input
					id="reuseable"
					type="checkbox"
					bind:checked={newReuseable}
					class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
				/>
				<label for="reuseable" class="ml-2 text-sm font-medium text-gray-700">Reuseable</label>
			</div>
			<div class="flex gap-2 sm:col-span-2">
				<button
					type="submit"
					class="hover:bg-opacity-90 rounded bg-primary px-4 py-2 text-white transition disabled:opacity-50"
					disabled={isLoading}
				>
					{editingInvitation ? 'Save' : 'Create'}
				</button>
				<button
					type="button"
					class="rounded bg-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-400"
					onclick={() => {
						showCreateForm = false;
						resetForm();
					}}
				>
					Cancel
				</button>
			</div>
		</form>
	</div>
{/if}

<div class="space-y-6">
	{#each [{ table: reusableTable, title: 'Reusable Invitations', reusable: true }, { table: singleUseTable, title: 'Single-Use Invitations', reusable: false }] as group (group.title)}
		<DataTable
			table={group.table}
			{columnLabels}
			title={group.title}
			loading={isLoading}
			hasLoaded={!isLoading || invitations.length > 0}
			search
			rowLabel="invitation"
			searchPlaceholder="Search title or email..."
			emptyTitle={group.reusable ? 'No reusable invitations' : 'No single-use invitations'}
			emptyDescription="Create one with the + button above."
		>
			{#snippet filters()}
				{#if group.table.getColumn('user_scope')}
					<FacetedFilter title="Scope" column={group.table.getColumn('user_scope')!} />
				{/if}
			{/snippet}

			{#snippet selectionActions()}
				<button
					class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={() => handleDelete(group.table.getSelectedRowIds())}
					disabled={isLoading}
				>
					<i class="fa-solid fa-trash-can text-xs"></i>
					Delete
				</button>
			{/snippet}

			{#snippet cell(columnId, row)}
				{@const invitation = row.original}
				{#if columnId === 'title'}
					{#if invitation.title}{invitation.title}{:else}<span class="text-gray-300">&ndash;</span
						>{/if}
				{:else if columnId === 'email'}
					{#if invitation.email}{invitation.email}{:else}<span class="text-gray-300">&ndash;</span
						>{/if}
				{:else if columnId === 'user_scope'}
					<span
						class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold {scopeColors[
							invitation.user_scope ?? 'user'
						] ?? 'bg-gray-100 text-gray-800'}"
					>
						{invitation.user_scope ?? 'user'}
					</span>
				{:else if columnId === 'expires_at'}
					{#if invitation.expires_at}
						<span
							class={isPast(invitation.expires_at) ? 'font-medium text-red-600' : 'text-gray-600'}
							title={formatDateFull(invitation.expires_at)}
						>
							{formatDate(invitation.expires_at)}
						</span>
					{:else}<span class="text-gray-300">&ndash;</span>{/if}
				{:else if columnId === 'user_expires'}
					{@const label = userExpiresLabel(invitation.user_expires)}
					{#if label}
						<span
							class={typeof invitation.user_expires === 'string' && isPast(invitation.user_expires)
								? 'font-medium text-red-600'
								: 'text-gray-600'}
						>
							{label}
						</span>
					{:else}<span class="text-gray-300">&ndash;</span>{/if}
				{:else if columnId === 'actions'}
					<button
						onclick={(e) => {
							e.stopPropagation();
							startEdit(invitation);
						}}
						class="mr-1 rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark"
						title="Edit invitation"
						aria-label="Edit invitation"
					>
						<i class="fa-solid fa-pencil text-xs"></i>
					</button>
					<button
						onclick={(e) => {
							e.stopPropagation();
							copyLink(invitation.invitation_link);
						}}
						class="rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark"
						title={invitation.invitation_link}
						aria-label="Copy invitation link"
					>
						<i class="fa-solid fa-copy text-xs"></i>
					</button>
				{/if}
			{/snippet}
		</DataTable>
	{/each}
</div>
