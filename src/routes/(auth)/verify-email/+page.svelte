<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';
	import ResendVerification from '$lib/components/ResendVerification.svelte';

	type Status = 'verifying' | 'success' | 'error';
	let status = $state<Status>('verifying');

	async function verify() {
		const token = page.url.searchParams.get('token');

		if (!token) {
			status = 'error';
			return;
		}

		try {
			const { error, response } = await Auth.verifyEmail({ body: { token } });

			if (error || !response?.ok) {
				// 400 → invalid or expired link.
				status = 'error';
			} else {
				status = 'success';
				// Send them to sign in shortly after confirming.
				setTimeout(() => goto(resolve('/login')), 2500);
			}
		} catch {
			status = 'error';
		}
	}

	$effect(() => {
		verify();
	});
</script>

<div class="mx-auto w-full max-w-sm lg:w-96">
	<div>
		<h2 class="text-center text-3xl font-bold tracking-tight text-dark">
			{#if status === 'success'}
				Email verified
			{:else if status === 'error'}
				Verification failed
			{:else}
				Verifying your email
			{/if}
		</h2>
	</div>

	<div class="mt-8">
		{#if status === 'verifying'}
			<p class="text-center text-sm text-gray-600">Please wait while we verify your email…</p>
		{:else if status === 'success'}
			<div class="rounded-md bg-green-50 p-4">
				<h3 class="text-sm font-medium text-green-800">
					Your email has been verified. Redirecting you to sign in…
				</h3>
				<div class="mt-4">
					<a
						href={resolve('/login')}
						class="text-sm font-medium text-green-800 underline hover:text-green-700"
					>
						Continue to sign in
					</a>
				</div>
			</div>
		{:else}
			<div class="space-y-6">
				<div class="rounded-md bg-red-50 p-4">
					<h3 class="text-sm font-medium text-red-800">
						This verification link is invalid or has expired.
					</h3>
				</div>

				<p class="text-sm text-gray-600">
					Enter your email address and we'll send you a new verification link.
				</p>

				<ResendVerification editable />

				<div class="text-center">
					<a
						href={resolve('/login')}
						class="text-sm font-medium text-primary hover:text-primary/80"
					>
						Back to sign in
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
