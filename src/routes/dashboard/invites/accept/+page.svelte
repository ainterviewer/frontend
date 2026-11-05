<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { CollaboratorInviteDetails } from '$lib/api';
	import { Folders } from '$lib/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { formatDay } from '$lib/utils/datetime';
	import { errorDetail } from '$lib/utils/errors';
	import { toastApiError } from '$lib/utils/toast';

	// The link from a collaborator invite email. Signed-out visitors come back
	// here after logging in (`/login?next=...`).
	const token = page.url.searchParams.get('token') ?? '';

	let details = $state<CollaboratorInviteDetails | null>(null);
	let problem = $state('');
	let isLoading = $state(true);
	let isAnswering = $state(false);

	onMount(() => {
		if (!token) {
			problem = 'This invitation link is incomplete. Open it again from the email.';
			isLoading = false;
			return;
		}
		Folders.inspectCollaboratorInvite({ body: { token } }).then(({ data, error }) => {
			if (error) problem = errorDetail(error, 'This invitation is no longer valid.');
			else details = data ?? null;
			isLoading = false;
		});
	});

	async function accept() {
		isAnswering = true;
		const { data: folder, error } = await Folders.acceptCollaboratorInvite({ body: { token } });
		isAnswering = false;
		if (error) {
			toastApiError(error, 'Failed to accept the invitation');
			return;
		}
		toast.success(`You now collaborate on ${folder.title}`);
		await goto(resolve('/dashboard'));
	}

	async function decline() {
		isAnswering = true;
		const { error } = await Folders.declineCollaboratorInvite({ body: { token } });
		isAnswering = false;
		if (error) {
			toastApiError(error, 'Failed to decline the invitation');
			return;
		}
		toast.success('Invitation declined');
		await goto(resolve('/dashboard'));
	}
</script>

<Sidebar items={mainSidebarItems} />
<h1 class="page-title">Folder Invitation</h1>

<div class="max-w-xl rounded border border-gray-200 bg-white p-8 shadow-sm">
	{#if isLoading}
		<p class="text-gray-500">Loading invitation…</p>
	{:else if details}
		<p class="mb-2">
			{details.invited_by_name ?? 'Someone'} invited you to collaborate on the folder
			<span class="font-semibold">{details.folder_title}</span>
			as <span class="font-semibold">{details.role}</span>.
		</p>
		<p class="mb-6 text-sm text-gray-500">
			You will be able to access all projects in the folder, with the permissions of that role. The
			invitation expires on {formatDay(details.expires_at)}.
		</p>
		<div class="flex gap-2">
			<button
				class="rounded border-none bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
				onclick={accept}
				disabled={isAnswering}
			>
				Accept
			</button>
			<button
				class="rounded border-none bg-gray-200 px-4 py-2 hover:bg-gray-300 disabled:opacity-50"
				onclick={decline}
				disabled={isAnswering}
			>
				Decline
			</button>
		</div>
	{:else}
		<p class="mb-6">{problem}</p>
		<a class="text-primary underline" href={resolve('/dashboard')}>Go to the dashboard</a>
	{/if}
</div>
