<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';

	const token = $derived(page.url.searchParams.get('token'));

	type Status = 'form' | 'success' | 'invalid';
	let status = $state<Status>('form');
	let showPasswords = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');

	async function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';

		const formData = new FormData(event.target as HTMLFormElement);
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password') as string;

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}

		if (!token) {
			status = 'invalid';
			return;
		}

		isLoading = true;
		try {
			const { error, response } = await Auth.resetPassword({
				body: { token, new_password: password }
			});

			if (response?.status === 400) {
				status = 'invalid';
			} else if (response?.status === 422) {
				errorMessage = 'Password must be between 8 and 72 characters.';
			} else if (error) {
				errorMessage = 'An unexpected error occurred';
			} else {
				status = 'success';
				setTimeout(() => goto(resolve('/login')), 2500);
			}
		} catch {
			errorMessage = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<!-- The reset token is in the URL; don't hand it to other origins. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="mx-auto w-full max-w-sm lg:w-96">
	<div>
		<h2 class="text-center text-3xl font-bold tracking-tight text-dark">
			{#if status === 'success'}
				Password reset
			{:else if status === 'invalid' || !token}
				Link expired
			{:else}
				Choose a new password
			{/if}
		</h2>
	</div>

	<div class="mt-8">
		{#if status === 'success'}
			<div class="rounded-md bg-green-50 p-4">
				<h3 class="text-sm font-medium text-green-800">
					Your password has been reset. Redirecting you to sign in…
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
		{:else if status === 'invalid' || !token}
			<div class="space-y-6">
				<div class="rounded-md bg-red-50 p-4">
					<h3 class="text-sm font-medium text-red-800">
						This password reset link is invalid or has expired.
					</h3>
				</div>

				<div class="text-center">
					<a
						href={resolve('/forgot-password')}
						class="text-sm font-medium text-primary hover:text-primary/80"
					>
						Request a new link
					</a>
				</div>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-6">
				{#if errorMessage}
					<div class="rounded-md bg-red-50 p-4">
						<div class="flex">
							<div class="ml-3">
								<h3 class="text-sm font-medium text-red-800">{errorMessage}</h3>
							</div>
						</div>
					</div>
				{/if}

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">
						New password
					</label>
					<div class="mt-1">
						<input
							id="password"
							name="password"
							type={showPasswords ? 'text' : 'password'}
							autocomplete="new-password"
							minlength="8"
							required
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
					</div>
				</div>

				<div>
					<label for="confirm_password" class="block text-sm font-medium text-gray-700">
						Confirm new password
					</label>
					<div class="mt-1">
						<input
							id="confirm_password"
							name="confirm_password"
							type={showPasswords ? 'text' : 'password'}
							autocomplete="new-password"
							minlength="8"
							required
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
					</div>
				</div>

				<label class="flex items-center gap-2 text-sm text-gray-600">
					<input
						type="checkbox"
						bind:checked={showPasswords}
						class="rounded border-gray-300 text-primary focus:ring-primary"
					/>
					Show passwords
				</label>

				<div>
					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isLoading}
							Saving...
						{:else}
							Reset password
						{/if}
					</button>
				</div>

				<div class="text-center">
					<a
						href={resolve('/login')}
						class="text-sm font-medium text-primary hover:text-primary/80"
					>
						Back to sign in
					</a>
				</div>
			</form>
		{/if}
	</div>
</div>
