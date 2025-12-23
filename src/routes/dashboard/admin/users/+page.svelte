<script lang="ts">
	import { Admin, type UserPublic } from '$lib/api';
	import { onMount } from 'svelte';

	let users = $state<UserPublic[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadUsers() {
		loading = true;
		error = null;
		try {
			const response = await Admin.getUsers();
			if (response.error) {
				error = 'Failed to load users';
				console.error(response.error);
			} else {
				// The API definition says the response is unknown, but we expect it to be an array of users
				users = (response.data as unknown as UserPublic[]) || [];
			}
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
				alert('Failed to delete user');
				console.error(response.error);
			} else {
				users = users.filter((u) => u.id !== id);
			}
		} catch (e) {
			alert('An unexpected error occurred');
			console.error(e);
		}
	}

	onMount(() => {
		loadUsers();
	});
</script>

<div class="h-full w-full p-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="page-title text-primary">User Management</h1>
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
						<th
							scope="col"
							class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-6"
							>Name</th
						>
						<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>Email</th
						>
						<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>Role</th
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
						<tr>
							<td
								class="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-gray-900 sm:pl-6"
							>
								{user.name}
							</td>
							<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">{user.email}</td>
							<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
								>
									{user.scope || 'User'}
								</span>
							</td>
							<td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
								{new Date(user.last_active).toLocaleDateString('en-GB', {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</td>
							<td
								class="relative py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-6"
							>
								<button
									onclick={() => deleteUser(user.id)}
									class="text-red-600 transition-colors hover:text-red-900"
								>
									Delete<span class="sr-only">, {user.name}</span>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
