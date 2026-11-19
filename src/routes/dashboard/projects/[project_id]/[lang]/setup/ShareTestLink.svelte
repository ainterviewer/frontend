<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import { formatDate } from '$lib/utils/datetime';
	import { isDemoRestricted } from '$lib/utils/errors';
	import { toastApiError } from '$lib/utils/toast';

	let {
		projectId,
		dataTour,
		blocked
	}: {
		projectId: string;
		dataTour?: string;
		/** Why no new link may be made, if it may not: a part is invalid. The
		 * menu still opens, to revoke the links already shared. */
		blocked?: string;
	} = $props();

	// The backend refuses demo accounts, and anyone below editor: a link anyone
	// can open hands out the unpublished draft.
	const isDemo = $derived(page.data.user?.scope === 'demo');
	// Site admins pass the backend's role check whatever their role here.
	const canShare = $derived(
		page.data.user?.scope === 'admin' ||
			page.data.permissions?.role === 'editor' ||
			page.data.permissions?.role === 'admin'
	);
	const disabledReason = $derived(
		isDemo
			? 'You cannot share test links with your current demo access'
			: !canShare
				? 'Only editors can share test links'
				: null
	);

	let open = $state(false);
	let creating = $state(false);
	let revoking = $state(false);
	// The link made while this menu was open. The backend keeps no list of
	// links to show again, only what revokes them all; a new one is a click.
	let link = $state<{ url: string; expires_at: string } | null>(null);

	function closeOnWindowClick(e: MouseEvent) {
		if (open && !(e.target as HTMLElement)?.closest('.share-test-menu')) open = false;
	}

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Test link copied');
		} catch {
			// Clipboard blocked: the link is in the field, selectable by hand.
			toast.info('Copy the link from the field');
		}
	}

	async function createLink() {
		creating = true;
		const { data, error } = await Projects.createTestShareLink({
			path: { project_id: projectId }
		});
		creating = false;
		if (error || !data) {
			if (isDemoRestricted(error)) {
				toast.error('Test links cannot be shared on a project a demo account owns');
			} else {
				toastApiError(error, 'Could not create a test link');
			}
			return;
		}
		link = data;
		await copy(data.url);
	}

	async function revokeLinks() {
		revoking = true;
		const { error } = await Projects.revokeTestShareLinks({ path: { project_id: projectId } });
		revoking = false;
		if (error) {
			toastApiError(error, 'Could not revoke the test links');
			return;
		}
		link = null;
		toast.success('Every test link of this project has been revoked');
	}
</script>

<svelte:window onclick={closeOnWindowClick} />

<div class="share-test-menu relative" data-tour={dataTour}>
	<button
		type="button"
		class="rounded-full border border-primary px-4 py-2 font-medium whitespace-nowrap text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 @5xl:px-6"
		onclick={() => (open = !open)}
		disabled={!!disabledReason}
		title={disabledReason ?? 'Share a test link'}
		aria-label="Share test link"
		aria-expanded={open}
	>
		<i class="fa-solid fa-share-nodes"></i>
		<span class="hidden @5xl:inline">Share test</span>
	</button>

	{#if open}
		<div
			class="absolute right-0 bottom-full mb-2 w-80 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg"
			role="dialog"
			aria-label="Share a test link"
		>
			<h3 class="font-semibold text-gray-900">Share a test link</h3>
			<p class="mt-1 text-gray-600">
				Anyone with the link can try the current draft, without an account. Their interviews show up
				under Tests, never in the study's data.
			</p>

			{#if link}
				<div class="mt-3 flex gap-2">
					<input
						type="text"
						readonly
						value={link.url}
						class="min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700"
						aria-label="Test link"
						onfocus={(e) => e.currentTarget.select()}
					/>
					<button
						type="button"
						class="rounded-md bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
						onclick={() => link && copy(link.url)}
						title="Copy link"
						aria-label="Copy link"
					>
						<i class="fa-solid fa-copy"></i>
					</button>
				</div>
				<p class="mt-1 text-xs text-gray-500">Valid until {formatDate(link.expires_at)}.</p>
			{:else}
				<button
					type="button"
					class="mt-3 w-full rounded-full bg-primary px-4 py-2 font-medium text-white not-disabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={createLink}
					disabled={creating || !!blocked}
					aria-describedby={blocked ? 'share-test-blocked' : undefined}
				>
					{creating ? 'Creating…' : 'Create and copy link'}
				</button>
				{#if blocked}
					<p id="share-test-blocked" class="mt-2 text-xs text-red-600">
						{blocked} Links you've already shared still open the old version until then.
					</p>
				{/if}
			{/if}

			<div class="mt-4 border-t border-gray-100 pt-3">
				<button
					type="button"
					class="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
					onclick={revokeLinks}
					disabled={revoking}
				>
					{revoking ? 'Revoking…' : 'Revoke all test links'}
				</button>
				<p class="mt-0.5 text-xs text-gray-500">
					Ends every link shared so far. Interviews already started carry on.
				</p>
			</div>
		</div>
	{/if}
</div>
