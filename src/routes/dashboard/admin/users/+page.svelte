<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Admin, type UserAdmin } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let users = $derived(data.users as UserAdmin[]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let expandedRows = $state(new Set<string>());
	let savingNote = $state(new Set<string>());

	const scopeColors: Record<string, string> = {
		admin: 'bg-purple-100 text-purple-800',
		user: 'bg-blue-100 text-blue-800',
		demo: 'bg-amber-100 text-amber-800',
		guest: 'bg-gray-100 text-gray-800'
	};

	$effect(() => {
		error = data.error;
	});

	function toggleRow(id: string) {
		const next = new Set(expandedRows);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedRows = next;
	}

	function isExpired(expiresAt: string | null | undefined): boolean {
		if (!expiresAt) return false;
		return new Date(expiresAt) < new Date();
	}

	function formatDate(date: string | null | undefined): string {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function loadUsers() {
		loading = true;
		try {
			await invalidateAll();
		} catch (e) {
			error = 'An unexpected error occurred';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function deleteUser(id: string) {
		if (!confirm('Are you sure you want to delete this user?')) return;

		try {
			const response = await Admin.deleteUser({
				query: { user_id: id }
			});

			if (response.error) {
				toast.error('Failed to delete user');
				console.error(response.error);
			} else {
				await invalidateAll();
				toast.success('User deleted');
			}
		} catch (e) {
			toast.error('An unexpected error occurred');
			console.error(e);
		}
	}

	async function saveAdminNote(user: UserAdmin, note: string) {
		const trimmed = note.trim() || null;
		if (trimmed === (user.admin_note ?? null)) return;

		const next = new Set(savingNote);
		next.add(user.id);
		savingNote = next;

		try {
			const response = await Admin.updateAdminNote({
				body: { note: trimmed },
				path: { user_id: user.id }
			});

			if (response.error) {
				toast.error('Failed to save note');
				console.error(response.error);
			} else {
				await invalidateAll();
				toast.success('Note saved');
			}
		} catch (e) {
			toast.error('An unexpected error occurred');
			console.error(e);
		} finally {
			const next = new Set(savingNote);
			next.delete(user.id);
			savingNote = next;
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="page-title">User Management</h1>
	<button
		onclick={loadUsers}
		class="hover:bg-opacity-90 rounded bg-primary px-4 py-2 text-white transition-colors"
	>
		Refresh
	</button>
</div>

{#if loading}
	<div class="flex justify-center p-8 text-gray-500">Loading users...</div>
{:else if error}
	<div
		class="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<strong class="font-bold">Error!</strong>
		<span class="block sm:inline">{error}</span>
	</div>
{:else if users.length === 0}
	<div class="rounded-lg bg-white p-8 text-center text-gray-500 shadow">No users found.</div>
{:else}
	<div class="ring-opacity-5 overflow-x-auto rounded-lg bg-white shadow ring-1 ring-black">
		<table class="min-w-full divide-y divide-gray-300">
			<thead class="bg-gray-50">
				<tr>
					<th scope="col" class="w-8 py-3.5 pl-3">
						<span class="sr-only">Expand</span>
					</th>
					<th
						scope="col"
						class="py-3.5 pr-3 pl-2 text-left text-sm font-semibold text-gray-900">Name</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
						>Email</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
						>Invitation</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
						>Organization</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
						>Expires</th
					>
					<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
						>Last Active</th
					>
					<th scope="col" class="relative py-3.5 pr-4 pl-3 sm:pr-6">
						<span class="sr-only">Actions</span>
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#each users as user (user.id)}
					<tr
						class="cursor-pointer hover:bg-gray-50"
						onclick={() => toggleRow(user.id)}
					>
						<td class="py-4 pl-3">
							<svg
								class="h-4 w-4 text-gray-400 transition-transform {expandedRows.has(user.id)
									? 'rotate-90'
									: ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</td>
						<td class="py-4 pr-3 pl-2 text-sm font-medium whitespace-nowrap text-gray-900">
							{user.first_name}{user.last_name ? ` ${user.last_name}` : ''}
						</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">{user.email}</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {scopeColors[
									user.scope ?? ''
								] ?? 'bg-green-100 text-green-800'}"
							>
								{user.scope ?? '-'}
							</span>
						</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
							{user.invitation_title ?? '-'}
						</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
							{user.organization ?? '-'}
						</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap {isExpired(user.expires_at) ? 'text-red-600 font-medium' : 'text-gray-500'}">
							{formatDate(user.expires_at)}
						</td>
						<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
							{formatDate(user.last_active)}
						</td>
						<td
							class="relative py-2 pr-2 pl-1 text-right text-sm font-medium whitespace-nowrap sm:pr-6"
						>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<button
								onclick={(e) => { e.stopPropagation(); deleteUser(user.id); }}
								class="rounded p-2 text-red-600 transition-colors hover:bg-red-200 hover:text-red-900"
							>
								Delete<span class="sr-only">, {user.first_name}</span>
							</button>
						</td>
					</tr>
					{#if expandedRows.has(user.id)}
						<tr class="bg-gray-50">
							<td colspan="9" class="px-6 py-4">
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
										<!-- svelte-ignore a11y_click_events_have_key_events -->
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
											}}
										></textarea>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
