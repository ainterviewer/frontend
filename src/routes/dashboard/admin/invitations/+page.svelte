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
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let invitations = $derived(data.invitations as InvitationPublic[]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
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

	let reusableAllSelected = $derived(
		reusableInvitations.length > 0 &&
			reusableInvitations.every((invitation) => selectedIds.has(invitation.id))
	);
	let singleUseAllSelected = $derived(
		singleUseInvitations.length > 0 &&
			singleUseInvitations.every((invitation) => selectedIds.has(invitation.id))
	);

	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800',
		user: 'bg-blue-100 text-blue-800',
		demo: 'bg-amber-100 text-amber-800',
		guest: 'bg-gray-100 text-gray-800'
	};

	$effect(() => {
		error = data.error;
	});

	async function loadInvitations() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
			selectedIds = new Set();
		} catch (e: any) {
			error = e.message || 'Failed to fetch invitations';
		} finally {
			isLoading = false;
		}
	}

	function toggleSelection(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleGroup(ids: string[], checked: boolean) {
		const newSet = new Set(selectedIds);
		if (checked) {
			ids.forEach((id) => newSet.add(id));
		} else {
			ids.forEach((id) => newSet.delete(id));
		}
		selectedIds = newSet;
	}

	async function handleDelete() {
		const ids = Array.from(selectedIds);
		if (ids.length === 0) {
			toast.error('Please select one or more invitations to delete.');
			return;
		}

		if (!confirm('Are you sure you want to delete these invitations?')) {
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
		} catch (e: any) {
			error = `Failed to delete invitations: ${e.message}`;
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
		} catch (e: any) {
			error = `Failed to create invitation: ${e.message}`;
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
		} catch (e: any) {
			error = `Failed to update invitation: ${e.message}`;
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
			class="cursor-pointer rounded bg-red-600 p-2 text-white transition hover:bg-red-700 disabled:opacity-50"
			onclick={handleDelete}
			title="Delete selected invitations"
			disabled={selectedIds.size === 0 || isLoading}
		>
			<i class="fa-solid fa-trash"></i>
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
				editingInvitation ? handleUpdate() : handleCreate();
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
	<div class="overflow-hidden rounded-lg bg-white shadow-md">
		<div class="border-b border-gray-200 bg-gray-50 px-6 py-3">
			<h3 class="text-sm font-semibold text-gray-700">Reusable Invitations</h3>
		</div>
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						<input
							type="checkbox"
							checked={reusableAllSelected}
							onchange={(e) =>
								toggleGroup(
									reusableInvitations.map((invitation) => invitation.id),
									e.currentTarget.checked
								)}
							class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
						/>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						<span class="inline-block w-64">Title</span>
					</th>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Scope</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Expires At</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>User Expires</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Actions</th
					>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#if isLoading && invitations.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-4 text-center text-gray-500">
							Loading invitations...
						</td>
					</tr>
				{:else if reusableInvitations.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-4 text-center text-gray-500">
							No reusable invitations found.
						</td>
					</tr>
				{:else}
					{#each reusableInvitations as invitation (invitation.id)}
						<tr
							class="cursor-pointer hover:bg-gray-50"
							tabindex="0"
							onclick={() => toggleSelection(invitation.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleSelection(invitation.id);
								}
							}}
						>
							<td class="px-6 py-4 whitespace-nowrap">
								<input
									type="checkbox"
									checked={selectedIds.has(invitation.id)}
									onchange={() => toggleSelection(invitation.id)}
									onclick={(e) => e.stopPropagation()}
									class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
								/>
							</td>
							<td class="w-64 px-6 py-4 text-sm whitespace-nowrap text-gray-900">
								{invitation.title || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span
									class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold {scopeColors[
										invitation.user_scope ?? 'user'
									] ?? 'bg-gray-100 text-gray-800'}"
								>
									{invitation.user_scope ?? 'user'}
								</span>
							</td>
							<td
								class="px-6 py-4 text-sm whitespace-nowrap {invitation.expires_at &&
								new Date(invitation.expires_at) < new Date()
									? 'text-red-500'
									: 'text-gray-500'}"
							>
								{invitation.expires_at ? new Date(invitation.expires_at).toLocaleString() : '-'}
							</td>
							<td
								class="px-6 py-4 text-sm whitespace-nowrap {invitation.user_expires &&
								typeof invitation.user_expires === 'string' &&
								new Date(invitation.user_expires) < new Date()
									? 'text-red-500'
									: 'text-gray-500'}"
							>
								{#if !invitation.user_expires}
									-
								{:else if typeof invitation.user_expires === 'string'}
									{new Date(invitation.user_expires).toLocaleString()}
								{:else}
									{[
										invitation.user_expires.days ? `${invitation.user_expires.days}d` : '',
										invitation.user_expires.hours ? `${invitation.user_expires.hours}h` : '',
										invitation.user_expires.minutes ? `${invitation.user_expires.minutes}m` : ''
									]
										.filter(Boolean)
										.join(' ') || '-'}
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex gap-1">
									<button
										onclick={(e) => {
											e.stopPropagation();
											startEdit(invitation);
										}}
										class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
										title="Edit invitation"
									>
										<i class="fa-solid fa-pencil"></i>
									</button>
									<button
										onclick={(e) => {
											e.stopPropagation();
											copyLink(invitation.invitation_link);
										}}
										class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
										title={invitation.invitation_link}
									>
										<i class="fa-solid fa-copy"></i>
										Copy link
									</button>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow-md">
		<div class="border-b border-gray-200 bg-gray-50 px-6 py-3">
			<h3 class="text-sm font-semibold text-gray-700">Single-Use Invitations</h3>
		</div>
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						<input
							type="checkbox"
							checked={singleUseAllSelected}
							onchange={(e) =>
								toggleGroup(
									singleUseInvitations.map((invitation) => invitation.id),
									e.currentTarget.checked
								)}
							class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
						/>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						<span class="inline-block w-64">Title</span>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						<span class="inline-block w-64">Email</span>
					</th>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Scope</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Expires At</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>User Expires</th
					>
					<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>Actions</th
					>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#if isLoading && invitations.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-4 text-center text-gray-500">
							Loading invitations...
						</td>
					</tr>
				{:else if singleUseInvitations.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-4 text-center text-gray-500">
							No single-use invitations found.
						</td>
					</tr>
				{:else}
					{#each singleUseInvitations as invitation (invitation.id)}
						<tr
							class="cursor-pointer hover:bg-gray-50"
							tabindex="0"
							onclick={() => toggleSelection(invitation.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleSelection(invitation.id);
								}
							}}
						>
							<td class="px-6 py-4 whitespace-nowrap">
								<input
									type="checkbox"
									checked={selectedIds.has(invitation.id)}
									onchange={() => toggleSelection(invitation.id)}
									onclick={(e) => e.stopPropagation()}
									class="cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
								/>
							</td>
							<td class="w-64 px-6 py-4 text-sm whitespace-nowrap text-gray-900">
								{invitation.title || '-'}
							</td>
							<td class="w-64 px-6 py-4 text-sm whitespace-nowrap text-gray-900">
								{invitation.email || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span
									class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold {scopeColors[
										invitation.user_scope ?? 'user'
									] ?? 'bg-gray-100 text-gray-800'}"
								>
									{invitation.user_scope ?? 'user'}
								</span>
							</td>
							<td
								class="px-6 py-4 text-sm whitespace-nowrap {invitation.expires_at &&
								new Date(invitation.expires_at) < new Date()
									? 'text-red-500'
									: 'text-gray-500'}"
							>
								{invitation.expires_at ? new Date(invitation.expires_at).toLocaleString() : '-'}
							</td>
							<td
								class="px-6 py-4 text-sm whitespace-nowrap {invitation.user_expires &&
								typeof invitation.user_expires === 'string' &&
								new Date(invitation.user_expires) < new Date()
									? 'text-red-500'
									: 'text-gray-500'}"
							>
								{#if !invitation.user_expires}
									-
								{:else if typeof invitation.user_expires === 'string'}
									{new Date(invitation.user_expires).toLocaleString()}
								{:else}
									{[
										invitation.user_expires.days ? `${invitation.user_expires.days}d` : '',
										invitation.user_expires.hours ? `${invitation.user_expires.hours}h` : '',
										invitation.user_expires.minutes ? `${invitation.user_expires.minutes}m` : ''
									]
										.filter(Boolean)
										.join(' ') || '-'}
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex gap-1">
									<button
										onclick={(e) => {
											e.stopPropagation();
											startEdit(invitation);
										}}
										class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
										title="Edit invitation"
									>
										<i class="fa-solid fa-pencil"></i>
									</button>
									<button
										onclick={(e) => {
											e.stopPropagation();
											copyLink(invitation.invitation_link);
										}}
										class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
										title={invitation.invitation_link}
									>
										<i class="fa-solid fa-copy"></i>
										Copy link
									</button>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
