<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';

	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let errorMessage = $state('');
	let isLoading = $state(false);

	async function handleSignup(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		const firstName = formData.get('first_name') as string;
		const lastName = (formData.get('last_name') as string) || undefined;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password') as string;

		const inviteToken = page.url.searchParams.get('token');

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			isLoading = false;
			return;
		}

		if (!inviteToken) {
			errorMessage = 'Signup token is missing';
			isLoading = false;
			return;
		}

		try {
			const { error } = await Auth.register({
				body: {
					email,
					password,
					first_name: firstName,
					last_name: lastName,
					invite_token: inviteToken
				}
			});

			if (error) {
				errorMessage = 'Registration failed. Please check your details and token.';
			} else {
				await goto(resolve('/login'));
			}
		} catch (e) {
			errorMessage = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- Right Side - Form -->
<div class="mx-auto w-full max-w-sm lg:w-96">
	<div>
		<h2 class="text-center text-3xl font-bold tracking-tight text-dark">Create an account</h2>
	</div>

	<div class="mt-8">
		<div class="mt-8">
			<form onsubmit={handleSignup} class="space-y-6">
				{#if errorMessage}
					<div class="rounded-md bg-red-50 p-4">
						<div class="flex">
							<div class="ml-3">
								<h3 class="text-sm font-medium text-red-800">{errorMessage}</h3>
							</div>
						</div>
					</div>
				{/if}

				<div class="flex gap-4">
					<div class="flex-1">
						<label for="first_name" class="block text-sm font-medium text-gray-700">
							First Name
						</label>
						<div class="mt-1">
							<input
								id="first_name"
								name="first_name"
								type="text"
								required
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
						</div>
					</div>
					<div class="flex-1">
						<label for="last_name" class="block text-sm font-medium text-gray-700">
							Last Name <span class="text-gray-400">(optional)</span>
						</label>
						<div class="mt-1">
							<input
								id="last_name"
								name="last_name"
								type="text"
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
						</div>
					</div>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700"> Email address </label>
					<div class="mt-1">
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
					</div>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700"> Password </label>
					<div class="relative mt-1 rounded-md shadow-sm">
						<input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 placeholder-gray-400 transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 flex items-center pr-3"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<svg
									class="h-5 w-5 text-gray-400 transition-colors hover:text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
							{:else}
								<svg
									class="h-5 w-5 text-gray-400 transition-colors hover:text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<div>
					<label for="confirm_password" class="block text-sm font-medium text-gray-700">
						Confirm Password
					</label>
					<div class="relative mt-1 rounded-md shadow-sm">
						<input
							id="confirm_password"
							name="confirm_password"
							type={showConfirmPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 placeholder-gray-400 transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 flex items-center pr-3"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
						>
							{#if showConfirmPassword}
								<svg
									class="h-5 w-5 text-gray-400 transition-colors hover:text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
							{:else}
								<svg
									class="h-5 w-5 text-gray-400 transition-colors hover:text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isLoading}
							Creating account...
						{:else}
							Sign up
						{/if}
					</button>
				</div>
			</form>

			<p class="mt-4 text-center text-sm text-gray-600">
				Already have an account?
				<a href="/login" class="font-medium text-primary transition-colors hover:text-primary/80"
					>Sign in</a
				>
			</p>
		</div>
	</div>
</div>
