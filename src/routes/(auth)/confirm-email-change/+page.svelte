<script lang="ts">
	import { onMount } from 'svelte';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';
	import { hasErrorCode } from '$lib/utils/errors';

	// The link from an email-change confirmation email. It needs no session:
	// following it proves the new address is yours.
	// `invalid`: spent, unknown or expired -- request the change again.
	// `taken`: another account got the address meanwhile.
	// `error`: anything else -- the server, the connection -- worth a retry.
	type Status = 'confirming' | 'success' | 'invalid' | 'taken' | 'error';
	let status = $state<Status>('confirming');

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			status = 'invalid';
			return;
		}
		const { error } = await Auth.confirmEmailChange({ body: { token } });
		if (!error) status = 'success';
		else if (hasErrorCode(error, 'email_link_invalid')) status = 'invalid';
		else if (hasErrorCode(error, 'email_taken')) status = 'taken';
		else status = 'error';
	});
</script>

<div class="mx-auto w-full max-w-sm lg:w-96">
	<h2 class="text-center text-3xl font-bold tracking-tight text-dark">
		{#if status === 'success'}
			Email changed
		{:else if status === 'confirming'}
			Confirming your new email
		{:else}
			Email not changed
		{/if}
	</h2>

	<div class="mt-8">
		{#if status === 'confirming'}
			<p class="text-center text-sm text-gray-600">Please wait while we confirm your email…</p>
		{:else if status === 'success'}
			<div class="rounded-md bg-green-50 p-4">
				<h3 class="text-sm font-medium text-green-800">
					Your account now uses this address. Other sessions were signed out.
				</h3>
				<div class="mt-4">
					<a
						href={resolve('/dashboard')}
						class="text-sm font-medium text-green-800 underline hover:text-green-700"
					>
						Continue to the dashboard
					</a>
				</div>
			</div>
		{:else}
			<div class="space-y-6">
				<div class="rounded-md bg-red-50 p-4">
					<h3 class="text-sm font-medium text-red-800">
						{#if status === 'invalid'}
							This confirmation link is invalid or has expired. Request the change again from your
							profile settings.
						{:else if status === 'taken'}
							Another account now uses this address, so your email was not changed.
						{:else}
							We couldn't confirm your email just now. Reload the page to try again.
						{/if}
					</h3>
				</div>
				<div class="text-center">
					<a
						href={resolve('/dashboard/settings/profile')}
						class="text-sm font-medium text-primary hover:text-primary/80"
					>
						Go to profile settings
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
