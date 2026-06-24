<script lang="ts">
	import { Auth } from '$lib/api';

	// `email` is pre-filled after register / failed login; when it is unknown
	// (e.g. an expired magic link), pass `editable` so the user can type it in.
	let { email = $bindable(''), editable = false }: { email?: string; editable?: boolean } =
		$props();

	let isLoading = $state(false);
	let message = $state('');
	let isError = $state(false);
	let cooldown = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	function startCooldown() {
		cooldown = 30;
		clearInterval(timer);
		timer = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0) clearInterval(timer);
		}, 1000);
	}

	// Clean up the interval when the component is destroyed.
	$effect(() => () => clearInterval(timer));

	async function handleResend() {
		if (isLoading || cooldown > 0 || !email) return;
		isLoading = true;
		message = '';
		isError = false;

		try {
			const { error, response } = await Auth.resendVerification({ body: { email } });

			// 502 means the email failed to send — let the user retry immediately.
			if (error || response?.status === 502) {
				isError = true;
				message = "We couldn't send the email just now. Please try again.";
			} else {
				// The endpoint always returns a generic 200 so we never reveal
				// whether an address is registered.
				message = "If an account exists for that email, we've sent a new verification link.";
				startCooldown();
			}
		} catch {
			isError = true;
			message = 'An unexpected error occurred. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="space-y-3">
	{#if editable}
		<div>
			<label for="resend-email" class="block text-sm font-medium text-gray-700">
				Email address
			</label>
			<div class="mt-1">
				<input
					id="resend-email"
					name="resend-email"
					type="email"
					autocomplete="email"
					bind:value={email}
					class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
				/>
			</div>
		</div>
	{/if}

	{#if message}
		<div class="rounded-md {isError ? 'bg-red-50' : 'bg-green-50'} p-4">
			<h3 class="text-sm font-medium {isError ? 'text-red-800' : 'text-green-800'}">
				{message}
			</h3>
		</div>
	{/if}

	<button
		type="button"
		onclick={handleResend}
		disabled={isLoading || cooldown > 0 || !email}
		class="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if isLoading}
			Sending...
		{:else if cooldown > 0}
			Resend in {cooldown}s
		{:else}
			Resend verification email
		{/if}
	</button>
</div>
