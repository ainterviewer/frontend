<script lang="ts">
	import { page } from '$app/state';
	import { Participants } from '$lib/api';
	import type { ParticipantPublic } from '$lib/api/types.gen';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const project_id = $derived(page.params.project_id as string);
	const isDemo = $derived(page.data.user?.scope === 'demo');

	let participants = $state<ParticipantPublic[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selected = $state(new Set<string>());

	type EditState = { name: string; email: string; pid: string; participating: boolean };
	let editingId = $state<string | null>(null);
	let editDraft = $state<EditState>({ name: '', email: '', pid: '', participating: true });

	type DraftRow = { name: string; email: string; pid: string; participating: boolean };
	const blankRow = (): DraftRow => ({ name: '', email: '', pid: '', participating: true });

	let showAddPanel = $state(false);
	let addRows = $state<DraftRow[]>([blankRow()]);
	let saving = $state(false);

	let fileInput: HTMLInputElement;

	const allSelected = $derived(
		participants.length > 0 && participants.every((p) => selected.has(p.id))
	);
	const isIndeterminate = $derived(participants.some((p) => selected.has(p.id)) && !allSelected);

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
	}

	function toggleOne(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleAll(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		const next = new Set(selected);
		for (const p of participants) {
			if (checked) next.add(p.id);
			else next.delete(p.id);
		}
		selected = next;
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
			const res = await Participants.addParticipant({
				path: { project_id },
				body: cleaned[0]
			});
			saving = false;
			if (res.error) {
				toast.error('Failed to add participant');
				return;
			}
			toast.success('Participant added');
		} else {
			const res = await Participants.addParticipants({
				path: { project_id },
				body: cleaned
			});
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
				pid: trimOrNull(editDraft.pid),
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
		const next = new Set(selected);
		next.delete(id);
		selected = next;
		await load();
	}

	async function deleteSelected() {
		if (selected.size === 0) return;
		if (!confirm(`Delete ${selected.size} participant(s)? This cannot be undone.`)) return;
		const res = await Participants.deleteParticipants({
			path: { project_id },
			body: { participant_ids: Array.from(selected) }
		});
		if (res.error) {
			toast.error('Failed to delete participants');
			return;
		}
		selected = new Set();
		await load();
	}

	async function handleUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const res = await Participants.uploadParticipants({
			path: { project_id },
			body: { file }
		});
		input.value = '';
		if (res.error) {
			toast.error('Failed to upload file');
			return;
		}
		toast.success('Participants uploaded');
		await load();
	}

	function formatDate(s: string | null | undefined) {
		if (!s) return '';
		return new Date(s).toLocaleString('en-GB', { hour12: false });
	}

	onMount(load);
</script>

<div class="mb-2 flex items-end justify-between">
	<h1 class="page-title">Participants</h1>
	<div class="flex gap-1">
		<button
			class="p-2 text-gray-600 transition-transform duration-300 hover:rotate-180 hover:text-gray-900"
			onclick={load}
			title="Refresh"
			disabled={isDemo}
		>
			<i class="fa-solid fa-arrows-rotate text-lg"></i>
		</button>
		<button
			class="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={openAdd}
			disabled={isDemo}
			title="Add participants"
		>
			<i class="fa-solid fa-plus text-lg"></i>
		</button>
		<button
			class="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={() => fileInput?.click()}
			disabled={isDemo}
			title="Upload CSV"
		>
			<i class="fa-solid fa-file-arrow-up text-lg"></i>
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept=".csv,.xlsx,.xls"
			class="hidden"
			onchange={handleUpload}
		/>
		<button
			class="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={exportParticipants}
			disabled={isDemo || participants.length === 0}
			title="Export CSV"
		>
			<i class="fa-solid fa-file-arrow-down text-lg"></i>
		</button>
		<button
			class="p-2 text-gray-600 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
			onclick={deleteSelected}
			disabled={isDemo || selected.size === 0}
			title="Delete selected"
		>
			<i class="fa-solid fa-trash-can text-lg"></i>
		</button>
	</div>
</div>

{#if error}
	<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
		{error}
	</div>
{/if}

{#if showAddPanel}
	<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow">
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

<div class="overflow-x-auto rounded-lg bg-white shadow">
	<table class="min-w-full leading-normal">
		<thead>
			<tr
				class="border-b-2 border-gray-200 bg-secondary text-left text-[13px] font-bold tracking-wider text-gray-900 uppercase"
			>
				<th class="w-12 px-5 py-3.5">
					<input
						type="checkbox"
						class="form-checkbox h-4 w-4 cursor-pointer text-primary focus:ring-primary"
						checked={allSelected}
						indeterminate={isIndeterminate}
						onchange={toggleAll}
					/>
				</th>
				<th class="px-5 py-3">Name</th>
				<th class="px-5 py-3">Email</th>
				<th class="px-5 py-3">PID</th>
				<th class="px-5 py-3">Participating</th>
				<th class="px-5 py-3">Created</th>
				<th class="px-5 py-3 text-right">Actions</th>
			</tr>
		</thead>
		<tbody class="bg-white">
			{#if loading}
				<tr>
					<td colspan="7" class="px-5 py-10 text-center text-gray-500">
						<i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading participants...
					</td>
				</tr>
			{:else if participants.length === 0}
				<tr>
					<td colspan="7" class="px-5 py-10 text-center text-gray-500"> No participants yet </td>
				</tr>
			{:else}
				{#each participants as p (p.id)}
					<tr class="border-b border-gray-200 text-sm hover:bg-gray-50">
						<td class="px-5 py-3">
							<input
								type="checkbox"
								class="form-checkbox h-4 w-4 cursor-pointer text-primary focus:ring-primary"
								checked={selected.has(p.id)}
								onchange={() => toggleOne(p.id)}
							/>
						</td>
						{#if editingId === p.id}
							<td class="px-5 py-2">
								<input
									type="text"
									bind:value={editDraft.name}
									class="w-full rounded border border-gray-300 px-2 py-1"
								/>
							</td>
							<td class="px-5 py-2">
								<input
									type="email"
									bind:value={editDraft.email}
									class="w-full rounded border border-gray-300 px-2 py-1"
								/>
							</td>
							<td class="px-5 py-2">
								<input
									type="text"
									bind:value={editDraft.pid}
									class="w-full rounded border border-gray-300 px-2 py-1"
								/>
							</td>
							<td class="px-5 py-2">
								<input
									type="checkbox"
									bind:checked={editDraft.participating}
									class="form-checkbox h-4 w-4 cursor-pointer text-primary"
								/>
							</td>
							<td class="px-5 py-2">{formatDate(p.created_at)}</td>
							<td class="px-5 py-2 text-right">
								<button
									class="mr-2 text-green-600 hover:text-green-800"
									onclick={() => saveEdit(p.id)}
									title="Save"
									aria-label="Save"
								>
									<i class="fa-solid fa-check"></i>
								</button>
								<button
									class="text-gray-500 hover:text-gray-700"
									onclick={cancelEdit}
									title="Cancel"
									aria-label="Cancel"
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</td>
						{:else}
							<td class="px-5 py-3">{p.name ?? ''}</td>
							<td class="px-5 py-3">{p.email ?? ''}</td>
							<td class="px-5 py-3 font-mono text-xs">{p.pid ?? ''}</td>
							<td class="px-5 py-3">
								{#if p.participating}
									<span
										class="rounded-full bg-green-100 px-2 py-1 text-xs leading-tight font-semibold text-green-700"
										>Yes</span
									>
								{:else}
									<span
										class="rounded-full bg-gray-100 px-2 py-1 text-xs leading-tight font-semibold text-gray-700"
										>No</span
									>
								{/if}
							</td>
							<td class="px-5 py-3">{formatDate(p.created_at)}</td>
							<td class="px-5 py-3 text-right">
								<button
									class="mr-3 text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
									onclick={() => startEdit(p)}
									disabled={isDemo}
									title="Edit"
									aria-label="Edit"
								>
									<i class="fa-solid fa-pen"></i>
								</button>
								<button
									class="text-gray-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
									onclick={() => deleteOne(p.id)}
									disabled={isDemo}
									title="Delete"
									aria-label="Delete"
								>
									<i class="fa-solid fa-trash-can"></i>
								</button>
							</td>
						{/if}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
