<script lang="ts">
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { Admin, type DemoBudget, type Scope, type UserAdminPublic } from '$lib/api';
	import DemoLimitFields from '$lib/components/DemoLimitFields.svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		type DataTableFeatures,
		dataTableFeatures,
		matchesSelection,
		sortableText,
		sortableTime
	} from '$lib/components/table/features';
	import { formatDate, formatDateFull } from '$lib/utils/datetime';
	import { toastApiError } from '$lib/utils/toast';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let users = $derived(data.users);
	let loading = $state(false);
	const expandedRows = new SvelteSet<string>();
	const savingNote = new SvelteSet<string>();
	const savingUser = new SvelteSet<string>();

	type UserEdit = {
		scope: Scope;
		with_preview_features: boolean;
		organization: string;
		expires_at: string;
		two_factor_enabled: boolean;
		demo_concurrent_limit: number | null;
		demo_daily_limit: number | null;
		demo_lifetime_limit: number | null;
	};
	let edits = $state<Record<string, UserEdit>>({});
	// Each expanded user's demo budget usage, fetched when the row opens.
	let demoUsage = $state<Record<string, DemoBudget>>({});

	const SCOPES: Scope[] = ['admin', 'user', 'demo'];

	function isoToLocalInput(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function localInputToIso(local: string): string | null {
		if (!local) return null;
		const d = new Date(local);
		if (isNaN(d.getTime())) return null;
		return d.toISOString();
	}

	function ensureEdit(user: UserAdminPublic): UserEdit {
		if (!edits[user.id]) {
			edits[user.id] = {
				scope: (user.scope as Scope) ?? 'user',
				with_preview_features: user.with_preview_features ?? false,
				organization: user.organization ?? '',
				expires_at: isoToLocalInput(user.expires_at),
				two_factor_enabled: user.two_factor_enabled ?? false,
				demo_concurrent_limit: user.demo_concurrent_limit ?? null,
				demo_daily_limit: user.demo_daily_limit ?? null,
				demo_lifetime_limit: user.demo_lifetime_limit ?? null
			};
		}
		return edits[user.id];
	}

	function isDirty(user: UserAdminPublic): boolean {
		const e = edits[user.id];
		if (!e) return false;
		return (
			e.scope !== ((user.scope as Scope) ?? 'user') ||
			e.with_preview_features !== (user.with_preview_features ?? false) ||
			e.organization !== (user.organization ?? '') ||
			e.expires_at !== isoToLocalInput(user.expires_at) ||
			e.two_factor_enabled !== (user.two_factor_enabled ?? false) ||
			e.demo_concurrent_limit !== (user.demo_concurrent_limit ?? null) ||
			e.demo_daily_limit !== (user.demo_daily_limit ?? null) ||
			e.demo_lifetime_limit !== (user.demo_lifetime_limit ?? null)
		);
	}

	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800',
		user: 'bg-blue-100 text-blue-800',
		demo: 'bg-amber-100 text-amber-800'
	};

	function toggleRow(user: UserAdminPublic) {
		if (expandedRows.has(user.id)) {
			expandedRows.delete(user.id);
		} else {
			expandedRows.add(user.id);
			ensureEdit(user);
			loadDemoUsage(user);
		}
	}

	// Fetched for every scope, so the usage is there if the scope is switched
	// to demo in the form. Shown only as context, so a failure is just logged.
	async function loadDemoUsage(user: UserAdminPublic) {
		const { data: budget, error: budgetError } = await Admin.getUserDemoBudget({
			path: { user_id: user.id }
		});
		if (budgetError || !budget) {
			console.error('Failed to load demo budget', budgetError);
			return;
		}
		demoUsage[user.id] = budget;
	}

	async function saveUser(user: UserAdminPublic) {
		const e = edits[user.id];
		if (!e) return;

		savingUser.add(user.id);

		try {
			const response = await Admin.updateUser({
				body: {
					scope: e.scope,
					with_preview_features: e.with_preview_features,
					organization: e.organization.trim() || null,
					expires_at: localInputToIso(e.expires_at),
					two_factor_enabled: e.two_factor_enabled,
					demo_concurrent_limit: e.demo_concurrent_limit,
					demo_daily_limit: e.demo_daily_limit,
					demo_lifetime_limit: e.demo_lifetime_limit
				},
				path: { user_id: user.id }
			});

			if (response.error) {
				toastApiError(response.error, 'Failed to update user');
			} else {
				delete edits[user.id];
				await invalidateAll();
				toast.success('User updated');
			}
		} finally {
			savingUser.delete(user.id);
		}
	}

	function resetEdit(user: UserAdminPublic) {
		delete edits[user.id];
		ensureEdit(user);
	}

	function isExpired(expiresAt: string | null | undefined): boolean {
		if (!expiresAt) return false;
		return new Date(expiresAt) < new Date();
	}

	async function loadUsers() {
		loading = true;
		try {
			await invalidateAll();
		} finally {
			loading = false;
		}
	}

	async function deleteUser(id: string) {
		if (!confirm('Are you sure you want to delete this user?')) return;

		const response = await Admin.deleteUser({
			query: { user_id: id }
		});

		if (response.error) {
			toastApiError(response.error, 'Failed to delete user');
		} else {
			await invalidateAll();
			toast.success('User deleted');
		}
	}

	async function saveAdminNote(user: UserAdminPublic, note: string) {
		const trimmed = note.trim() || null;
		if (trimmed === (user.admin_note ?? null)) return;

		savingNote.add(user.id);

		try {
			const response = await Admin.updateAdminNote({
				body: { note: trimmed },
				path: { user_id: user.id }
			});

			if (response.error) {
				toastApiError(response.error, 'Failed to save note');
			} else {
				await invalidateAll();
				toast.success('Note saved');
			}
		} finally {
			savingNote.delete(user.id);
		}
	}

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, UserAdminPublic>();

	const fullName = (u: UserAdminPublic) => `${u.first_name}${u.last_name ? ` ${u.last_name}` : ''}`;

	const columns = helper.columns([
		helper.display({ id: 'expand', enableHiding: false, meta: { class: 'w-8' } }),
		helper.accessor((u) => sortableText(fullName(u)), {
			id: 'name',
			header: 'Name',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-medium whitespace-nowrap text-dark' }
		}),
		helper.accessor((u) => sortableText(u.email), {
			id: 'email',
			header: 'Email',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap text-gray-700' }
		}),
		helper.accessor((u) => sortableText(u.scope), {
			id: 'scope',
			header: 'Role',
			sortFn: 'text',
			sortUndefined: 'last',
			filterFn: matchesSelection
		}),
		helper.accessor((u) => u.two_factor_enabled ?? false, {
			id: 'two_factor_enabled',
			header: '2FA',
			sortFn: 'basic',
			filterFn: matchesSelection
		}),
		helper.accessor((u) => sortableText(u.invitation_title), {
			id: 'invitation_title',
			header: 'Invitation',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap text-gray-600' }
		}),
		helper.accessor((u) => sortableText(u.organization), {
			id: 'organization',
			header: 'Organization',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap text-gray-600' }
		}),
		helper.accessor((u) => sortableTime(u.expires_at), {
			id: 'expires_at',
			header: 'Expires',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums' }
		}),
		helper.accessor((u) => sortableTime(u.last_active), {
			id: 'last_active',
			header: 'Last active',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.display({
			id: 'actions',
			header: 'Actions',
			enableHiding: false,
			meta: { align: 'right', class: 'whitespace-nowrap' }
		})
	]);

	const searchableColumns = ['name', 'email', 'organization', 'invitation_title'];

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return users;
		},
		getRowId: (u) => u.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchableColumns.includes(column.id),
		initialState: {
			pagination: { pageIndex: 0, pageSize: 25 },
			sorting: [{ id: 'last_active', desc: true }]
		}
	});

	const columnLabels: Record<string, string> = {
		name: 'Name',
		email: 'Email',
		scope: 'Role',
		two_factor_enabled: '2FA',
		invitation_title: 'Invitation',
		organization: 'Organization',
		expires_at: 'Expires',
		last_active: 'Last active'
	};
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h1 class="page-title mb-0">User Management</h1>
	<button
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={loadUsers}
		title="Refresh"
		aria-label="Refresh"
		disabled={loading}
	>
		<i class="fa-solid fa-arrows-rotate {loading ? 'animate-spin' : ''}"></i>
	</button>
</div>

<DataTable
	{table}
	{columnLabels}
	{loading}
	hasLoaded={!loading}
	selectable={false}
	search
	rowLabel="user"
	searchPlaceholder="Search name, email or organization..."
	emptyTitle="No users found"
	onRowClick={(row) => toggleRow(row.original)}
	isExpanded={(row) => expandedRows.has(row.original.id)}
>
	{#snippet filters()}
		{#if table.getColumn('scope')}
			<FacetedFilter title="Role" column={table.getColumn('scope')!} />
		{/if}
		{#if table.getColumn('two_factor_enabled')}
			<FacetedFilter
				title="2FA"
				column={table.getColumn('two_factor_enabled')!}
				options={[
					{ value: 'true', label: 'On' },
					{ value: 'false', label: 'Off' }
				]}
			/>
		{/if}
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const user = row.original}
		{#if columnId === 'expand'}
			<i
				class="fa-solid fa-chevron-right text-xs text-gray-400 transition-transform {expandedRows.has(
					user.id
				)
					? 'rotate-90'
					: ''}"
			></i>
		{:else if columnId === 'name'}
			{user.first_name}{user.last_name ? ` ${user.last_name}` : ''}
		{:else if columnId === 'email'}
			{user.email}
		{:else if columnId === 'scope'}
			<span
				class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {scopeColors[
					user.scope ?? ''
				] ?? 'bg-green-100 text-green-800'}"
			>
				{user.scope ?? '-'}
			</span>
		{:else if columnId === 'two_factor_enabled'}
			<span
				class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {user.two_factor_enabled
					? 'bg-green-100 text-green-800'
					: 'bg-gray-100 text-gray-600'}"
			>
				{user.two_factor_enabled ? 'On' : 'Off'}
			</span>
		{:else if columnId === 'invitation_title'}
			{#if user.invitation_title}{user.invitation_title}{:else}<span class="text-gray-300"
					>&ndash;</span
				>{/if}
		{:else if columnId === 'organization'}
			{#if user.organization}{user.organization}{:else}<span class="text-gray-300">&ndash;</span
				>{/if}
		{:else if columnId === 'expires_at'}
			{#if user.expires_at}
				<span
					class={isExpired(user.expires_at) ? 'font-medium text-red-600' : 'text-gray-600'}
					title={formatDateFull(user.expires_at)}
				>
					{formatDate(user.expires_at)}
				</span>
			{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'last_active'}
			{#if user.last_active}
				<span title={formatDateFull(user.last_active)}>{formatDate(user.last_active)}</span>
			{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'actions'}
			<button
				onclick={(e) => {
					e.stopPropagation();
					deleteUser(user.id);
				}}
				class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
				title="Delete user"
			>
				<i class="fa-solid fa-trash-can text-xs"></i>
				<span class="sr-only">Delete {user.first_name}</span>
			</button>
		{/if}
	{/snippet}

	{#snippet expandedRow(row)}
		{@const user = row.original}
		{@const edit = ensureEdit(user)}
		{@const dirty = isDirty(user)}
		{@const saving = savingUser.has(user.id)}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<h4 class="text-sm font-semibold text-gray-700">Access Request Message</h4>
				<p class="mt-1 text-sm text-gray-600">
					{user.access_request_message ?? 'No message provided'}
				</p>
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h4 class="text-sm font-semibold text-gray-700">Admin Note</h4>
					{#if savingNote.has(user.id)}
						<span class="text-xs text-gray-400">Saving...</span>
					{:else if user.admin_note_updated_at}
						<span class="text-xs text-gray-400">
							Updated {formatDate(user.admin_note_updated_at)}
						</span>
					{/if}
				</div>
				<textarea
					class="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
					rows="2"
					placeholder="Add a note..."
					value={user.admin_note ?? ''}
					onclick={(e) => e.stopPropagation()}
					onblur={(e) => saveAdminNote(user, e.currentTarget.value)}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}></textarea>
			</div>
		</div>
		<div class="mt-4 border-t border-gray-200 pt-4">
			<h4 class="mb-2 text-sm font-semibold text-gray-700">Edit User</h4>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<label class="block text-sm">
					<span class="text-xs font-medium text-gray-600">Scope</span>
					<select
						class="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
						bind:value={edit.scope}
						onclick={(e) => e.stopPropagation()}
					>
						{#each SCOPES as s (s)}
							<option value={s}>{s}</option>
						{/each}
					</select>
				</label>
				<label class="block text-sm">
					<span class="text-xs font-medium text-gray-600">Organization</span>
					<input
						type="text"
						class="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
						placeholder="-"
						bind:value={edit.organization}
						onclick={(e) => e.stopPropagation()}
					/>
				</label>
				<label class="block text-sm">
					<span class="text-xs font-medium text-gray-600">Expires At</span>
					<input
						type="datetime-local"
						class="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
						bind:value={edit.expires_at}
						onclick={(e) => e.stopPropagation()}
					/>
				</label>
			</div>
			<div class="mt-5 mb-1 flex flex-wrap gap-x-6 gap-y-2">
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={edit.with_preview_features}
						onclick={(e) => e.stopPropagation()}
					/>
					<span class="text-xs font-medium text-gray-600">Preview features enabled</span>
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
						bind:checked={edit.two_factor_enabled}
						onclick={(e) => e.stopPropagation()}
					/>
					<span class="text-xs font-medium text-gray-600">Two-factor authentication enabled</span>
				</label>
			</div>
			{#if edit.scope === 'demo'}
				<div class="mt-4 md:w-1/2">
					<DemoLimitFields
						defaults={data.demoLimitDefaults}
						usage={demoUsage[user.id]}
						bind:concurrent={edit.demo_concurrent_limit}
						bind:daily={edit.demo_daily_limit}
						bind:lifetime={edit.demo_lifetime_limit}
					/>
				</div>
			{/if}
			<div class="mt-4 flex items-center justify-end gap-2">
				{#if dirty && !saving}
					<button
						onclick={(e) => {
							e.stopPropagation();
							resetEdit(user);
						}}
						class="rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
					>
						Reset
					</button>
				{/if}
				<button
					disabled={!dirty || saving}
					onclick={(e) => {
						e.stopPropagation();
						saveUser(user);
					}}
					class="rounded bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	{/snippet}
</DataTable>
