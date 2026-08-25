<script lang="ts">
	import { page } from '$app/state';
	import { Participants } from '$lib/api';
	import type { ParticipantPublic } from '$lib/api/types.gen';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		formatDate,
		formatDateFull,
		matchesSelection,
		sortableText,
		sortableTime,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const project_id = $derived(page.params.project_id as string);
	const isDemo = $derived(page.data.user?.scope === 'demo');

	let participants = $state<ParticipantPublic[]>([]);
	let loading = $state(false);
	let hasLoaded = $state(false);
	let error = $state<string | null>(null);

	type EditState = { name: string; email: string; pid: string; participating: boolean };
	let editingId = $state<string | null>(null);
	let editDraft = $state<EditState>({ name: '', email: '', pid: '', participating: true });

	type DraftRow = { name: string; email: string; pid: string; participating: boolean };
	const blankRow = (): DraftRow => ({ name: '', email: '', pid: '', participating: true });

	let showAddPanel = $state(false);
	let addRows = $state<DraftRow[]>([blankRow()]);
	let saving = $state(false);

	let fileInput: HTMLInputElement;

	/** Each click adds a full turn, so the icon spins once per refresh. */
	let refreshTurns = $state(0);

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, ParticipantPublic>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.accessor((p) => sortableText(p.name), {
			id: 'name',
			header: 'Name',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-medium text-dark' }
		}),
		helper.accessor((p) => sortableText(p.email), {
			id: 'email',
			header: 'Email',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'text-gray-700' }
		}),
		helper.accessor((p) => sortableText(p.pid), {
			id: 'pid',
			header: 'PID',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-mono text-xs text-gray-500' }
		}),
		helper.accessor('participating', {
			header: 'Participating',
			sortFn: 'basic',
			filterFn: matchesSelection
		}),
		helper.accessor((p) => sortableTime(p.created_at), {
			id: 'created_at',
			header: 'Created',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor((p) => sortableTime(p.latest_interview_at), {
			id: 'latest_interview_at',
			header: 'Latest interview activity',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor((p) => sortableText(p.latest_interview_status), {
			id: 'latest_interview_status',
			header: 'Latest interview status',
			sortFn: 'text',
			sortUndefined: 'last',
			filterFn: matchesSelection,
			meta: { class: 'text-gray-600' }
		}),
		helper.display({
			id: 'actions',
			header: 'Actions',
			enableHiding: false,
			meta: { align: 'right', class: 'whitespace-nowrap' }
		})
	]);

	const searchableColumns = ['name', 'email', 'pid'];

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return participants;
		},
		getRowId: (p) => p.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchableColumns.includes(column.id),
		initialState: {
			pagination: { pageIndex: 0, pageSize: 25 },
			sorting: [{ id: 'created_at', desc: true }]
		}
	});

	const columnLabels: Record<string, string> = {
		name: 'Name',
		email: 'Email',
		pid: 'PID',
		participating: 'Participating',
		created_at: 'Created',
		latest_interview_at: 'Latest interview activity',
		latest_interview_status: 'Latest interview status'
	};

	const selectedIds = $derived(table.getSelectedRowIds());

	/* ----------------------------------------------------------------- data */

	async function load() {
		loading = true;
		error = null;
		const res = await Participants.getParticipants({ path: { project_id } });
		if (res.error) {
			error = 'Failed to load participants';
			participants = [];
		} else {
			participants = (res.data ?? []) as ParticipantPublic[];
		}
		loading = false;
		hasLoaded = true;
	}

	function trimOrNull(v: string): string | null {
		const t = v.trim();
		return t ? t : null;
	}

	function addRow() {
		addRows = [...addRows, blankRow()];
	}

	function removeRow(idx: number) {
		addRows = addRows.filter((_, i) => i !== idx);
		if (addRows.length === 0) addRows = [blankRow()];
	}

	function openAdd() {
		addRows = [blankRow()];
		showAddPanel = true;
	}

	function cancelAdd() {
		showAddPanel = false;
		addRows = [blankRow()];
	}

	async function exportParticipants() {
		const { data, error: exportError } = await Participants.exportParticipants({
			path: { project_id },
			body: { participant_ids: selectedIds },
			parseAs: 'blob'
		});
		if (exportError) {
			toast.error('Failed to export participants');
			return;
		}
		if (!data) return;
		const url = window.URL.createObjectURL(data as Blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `participants_${project_id}.csv`;
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}

	async function saveAdd() {
		const cleaned = addRows
			.map((r) => ({
				name: trimOrNull(r.name),
				email: trimOrNull(r.email),
				pid: trimOrNull(r.pid),
				participating: r.participating
			}))
			.filter((r) => r.name || r.email || r.pid);

		if (cleaned.length === 0) {
			toast.error('Please fill in at least one row');
			return;
		}

		saving = true;
		if (cleaned.length === 1) {
			const res = await Participants.addParticipant({ path: { project_id }, body: cleaned[0] });
			saving = false;
			if (res.error) {
				toast.error('Failed to add participant');
				return;
			}
			toast.success('Participant added');
		} else {
			const res = await Participants.addParticipants({ path: { project_id }, body: cleaned });
			saving = false;
			if (res.error) {
				toast.error('Failed to add participants');
				return;
			}
			toast.success(`Added ${cleaned.length} participants`);
		}
		showAddPanel = false;
		addRows = [blankRow()];
		await load();
	}

	function startEdit(p: ParticipantPublic) {
		editingId = p.id;
		editDraft = {
			name: p.name ?? '',
			email: p.email ?? '',
			pid: p.pid ?? '',
			participating: p.participating ?? true
		};
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit(id: string) {
		const res = await Participants.updateParticipant({
			path: { project_id, participant_id: id },
			body: {
				name: trimOrNull(editDraft.name),
				email: trimOrNull(editDraft.email),
				pid: trimOrNull(editDraft.pid) ?? undefined,
				participating: editDraft.participating
			}
		});
		if (res.error) {
			toast.error('Failed to update participant');
			return;
		}
		editingId = null;
		await load();
	}

	async function deleteOne(id: string) {
		if (!confirm('Delete this participant?')) return;
		const res = await Participants.deleteParticipant({
			path: { project_id, participant_id: id }
		});
		if (res.error) {
			toast.error('Failed to delete participant');
			return;
		}
		// Row selection is independent state and keeps ids after the row is gone.
		table.setRowSelection((old) => {
			const next = { ...old };
			delete next[id];
			return next;
		});
		await load();
	}

	async function deleteSelected() {
		if (selectedIds.length === 0) return;
		if (!confirm(`Delete ${selectedIds.length} participant(s)? This cannot be undone.`)) return;
		const res = await Participants.deleteParticipants({
			path: { project_id },
			body: { participant_ids: selectedIds }
		});
		if (res.error) {
			toast.error('Failed to delete participants');
			return;
		}
		table.resetRowSelection(true);
		await load();
	}

	async function handleUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const res = await Participants.uploadParticipants({ path: { project_id }, body: { file } });
		input.value = '';
		if (res.error) {
			toast.error('Failed to upload file');
			return;
		}
		const skipped = res.data?.skipped_rows ?? 0;
		const added = res.data?.participants.length ?? 0;
		toast.success(
			skipped > 0
				? `${added} participant(s) added, ${skipped} blank row(s) skipped`
				: `${added} participant(s) added`
		);
		await load();
	}

	onMount(load);
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<h1 class="page-title mb-0">Participants</h1>
	<div class="flex items-center gap-1">
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={() => {
				refreshTurns += 1;
				load();
			}}
			title="Refresh"
			aria-label="Refresh"
			disabled={isDemo}
		>
			<i
				class="fa-solid fa-arrows-rotate transition-transform duration-500 ease-out"
				style="transform: rotate({refreshTurns * 360}deg)"
			></i>
		</button>
		<span class="mx-1 h-6 w-px bg-gray-200"></span>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={openAdd}
			disabled={isDemo}
			title="Add participants"
			aria-label="Add participants"
		>
			<i class="fa-solid fa-plus"></i>
		</button>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={() => fileInput?.click()}
			disabled={isDemo}
			title="Upload CSV or Excel file"
			aria-label="Upload CSV or Excel file"
		>
			<i class="fa-solid fa-file-arrow-up"></i>
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept=".csv,.xlsx,.xls"
			class="hidden"
			onchange={handleUpload}
		/>
		<button
			class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
			onclick={exportParticipants}
			disabled={isDemo || participants.length === 0}
			title={selectedIds.length > 0
				? `Export ${selectedIds.length} selected as CSV`
				: 'Export all as CSV'}
			aria-label="Export CSV"
		>
			<i class="fa-solid fa-file-arrow-down"></i>
		</button>
	</div>
</div>

{#if error}
	<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
		{error}
	</div>
{/if}

{#if showAddPanel}
	<div class="mb-4 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-700">
				Add participants ({addRows.length} row{addRows.length === 1 ? '' : 's'})
			</h2>
			<button class="text-gray-500 hover:text-gray-700" onclick={cancelAdd} title="Close">
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="text-left text-xs font-semibold tracking-wider text-gray-600 uppercase">
						<th class="px-2 py-2">Name</th>
						<th class="px-2 py-2">Email</th>
						<th class="px-2 py-2">PID</th>
						<th class="px-2 py-2">Participating</th>
						<th class="w-10 px-2 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each addRows as row, i (i)}
						<tr class="border-t border-gray-100">
							<td class="px-2 py-1.5">
								<input
									type="text"
									bind:value={row.name}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="email"
									bind:value={row.email}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="text"
									bind:value={row.pid}
									class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
								/>
							</td>
							<td class="px-2 py-1.5">
								<input
									type="checkbox"
									bind:checked={row.participating}
									class="form-checkbox h-4 w-4 cursor-pointer text-primary"
								/>
							</td>
							<td class="px-2 py-1.5 text-right">
								<button
									class="text-gray-400 hover:text-red-600"
									onclick={() => removeRow(i)}
									title="Remove row"
									aria-label="Remove row"
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="mt-3 flex items-center justify-between">
			<button
				class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
				onclick={addRow}
			>
				<i class="fa-solid fa-plus mr-1"></i> Add row
			</button>
			<div class="flex gap-2">
				<button
					class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
					onclick={cancelAdd}
				>
					Cancel
				</button>
				<button
					class="rounded bg-primary px-3 py-1 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					onclick={saveAdd}
					disabled={saving}
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	{loading}
	{hasLoaded}
	search
	searchPlaceholder="Search name, email or PID..."
	rowLabel="participant"
	emptyTitle="No participants yet"
	emptyDescription="Add participants directly, or upload a CSV or Excel file."
>
	{#snippet filters()}
		{#if table.getColumn('participating')}
			<FacetedFilter
				title="Participating"
				column={table.getColumn('participating')!}
				options={[
					{ value: 'true', label: 'Yes' },
					{ value: 'false', label: 'No' }
				]}
			/>
		{/if}
		{#if table.getColumn('latest_interview_status')}
			<FacetedFilter title="Status" column={table.getColumn('latest_interview_status')!} />
		{/if}
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
			onclick={deleteSelected}
			disabled={isDemo}
		>
			<i class="fa-solid fa-trash-can text-xs"></i>
			Delete
		</button>
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const p = row.original}
		{@const editing = editingId === p.id}
		{#if columnId === 'name'}
			{#if editing}
				<input
					type="text"
					bind:value={editDraft.name}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.name}{p.name}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'email'}
			{#if editing}
				<input
					type="email"
					bind:value={editDraft.email}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.email}{p.email}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'pid'}
			{#if editing}
				<input
					type="text"
					bind:value={editDraft.pid}
					class="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
				/>
			{:else if p.pid}{p.pid}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'participating'}
			{#if editing}
				<input
					type="checkbox"
					bind:checked={editDraft.participating}
					class="form-checkbox h-4 w-4 cursor-pointer rounded border-gray-400 text-primary"
				/>
			{:else if p.participating}
				<span class="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
					Yes
				</span>
			{:else}
				<span class="rounded-full bg-red-800/20 px-2 py-0.5 text-xs font-semibold text-red-800">
					No
				</span>
			{/if}
		{:else if columnId === 'created_at'}
			<span title={formatDateFull(p.created_at)}>{formatDate(p.created_at)}</span>
		{:else if columnId === 'latest_interview_at'}
			{#if p.latest_interview_at}
				<span title={formatDateFull(p.latest_interview_at)}>
					{formatDate(p.latest_interview_at)}
				</span>
			{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'latest_interview_status'}
			{#if p.latest_interview_status}{p.latest_interview_status}{:else}<span class="text-gray-300"
					>&ndash;</span
				>{/if}
		{:else if columnId === 'actions'}
			{#if editing}
				<button
					class="mr-1 rounded p-1.5 text-primary hover:bg-primary/10"
					onclick={() => saveEdit(p.id)}
					title="Save changes"
					aria-label="Save changes"
				>
					<i class="fa-solid fa-check"></i>
				</button>
				<button
					class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-dark"
					onclick={cancelEdit}
					title="Cancel"
					aria-label="Cancel"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{:else}
				<button
					class="mr-1 rounded p-1.5 text-gray-400 hover:bg-secondary/40 hover:text-dark disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
					onclick={() => startEdit(p)}
					disabled={isDemo}
					title="Edit"
					aria-label="Edit"
				>
					<i class="fa-solid fa-pen text-xs"></i>
				</button>
				<button
					class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
					onclick={() => deleteOne(p.id)}
					disabled={isDemo}
					title="Delete"
					aria-label="Delete"
				>
					<i class="fa-solid fa-trash-can text-xs"></i>
				</button>
			{/if}
		{/if}
	{/snippet}
</DataTable>
