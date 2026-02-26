<script lang="ts">
	let email = $state('');
	let isLoading = $state(false);
	let isSuccess = $state(false);
	let errorMessage = $state('');

	async function handleReset(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		// Mock API call since endpoint is missing
		try {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			isSuccess = true;
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
		<h2 class="text-center text-3xl font-bold tracking-tight text-dark">Reset password</h2>
		<p class="mt-4 text-sm text-gray-600">
			Enter your email address and we'll send you a link to reset your password.
		</p>
	</div>

	<div class="mt-6">
		{#if isSuccess}
			<div class="rounded-md bg-green-50 p-4">
				<div class="flex">
					<div class="ml-3">
						<h3 class="text-sm font-medium text-green-800">
							If an account exists with this email, you will receive a password reset link.
						</h3>
						<div class="mt-4">
							<a
								href="/login"
								class="text-sm font-medium text-green-800 underline hover:text-green-700"
							>
								Return to sign in
							</a>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<form onsubmit={handleReset} class="space-y-6">
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
					<label for="email" class="block text-sm font-medium text-gray-700"> Email address </label>
					<div class="mt-1">
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isLoading}
							Sending...
						{:else}
							Send reset link
						{/if}
					</button>
				</div>

				<div class="text-center">
					<a href="/login" class="text-sm font-medium text-primary hover:text-primary/80">
						Back to sign in
					</a>
				</div>
			</form>
		{/if}
	</div>
</div>
