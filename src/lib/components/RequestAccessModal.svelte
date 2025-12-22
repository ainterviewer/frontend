<script lang="ts">
	import { Auth } from '$lib/api';
	import { fade, fly } from 'svelte/transition';

	let { isOpen = false, close } = $props();

	let errorMessage = $state('');
	let isLoading = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const message = formData.get('message') as string;
		const organization = formData.get('organization') as string;

		try {
			const { error } = await Auth.requestAccess({
				body: { name, email, message, organization }
			});

			if (error) {
				errorMessage = 'Invalid request';
			}
		} catch (e) {
			errorMessage = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}

		close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<!-- Backdrop -->
		<button
			class="fixed inset-0 h-full w-full cursor-default bg-dark/80 transition-opacity focus:outline-none"
			transition:fade={{ duration: 200 }}
			onclick={close}
			aria-label="Close modal"
			type="button"
		></button>

		<!-- Modal Panel -->
		<div
			class="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-light shadow-2xl transition-all"
			transition:fly={{ y: 20, duration: 300 }}
		>
			<div class="absolute top-0 right-0 pt-4 pr-4">
				<button
					type="button"
					class="rounded-md bg-light text-dark/50 hover:text-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
					onclick={close}
				>
					<span class="sr-only">Close</span>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="px-6 py-8 sm:p-10">
				<div class="text-center">
					<h3 class="text-2xl font-extrabold tracking-tight text-dark">Request Access</h3>
					<p class="mt-4 text-sm text-gray-700">
						We are currently onboarding select partners at a slow pace - so don't be discouraged if
						our response is delayed.
						<br />
						You can join the waitlist by signing up below.
					</p>
				</div>

				<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
					<div>
						<label for="name" class="block text-sm font-medium text-dark"> Full Name </label>
						<div class="mt-1">
							<input
								id="name"
								name="name"
								type="text"
								required
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="email" class="block text-sm font-medium text-dark"> Email address </label>
						<div class="mt-1">
							<input
								id="email"
								name="email"
								type="email"
								autocomplete="email"
								required
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="organization" class="block text-sm font-medium text-dark">
							Organization / Institution
						</label>
						<div class="mt-1">
							<input
								id="organization"
								name="organization"
								type="text"
								required
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="message" class="block text-sm font-medium text-dark"> Purpose </label>
						<div class="mt-1">
							<textarea
								id="message"
								name="message"
								rows="3"
								class="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
							></textarea>
						</div>
					</div>

					<div>
						<button
							type="submit"
							class="flex w-full cursor-pointer justify-center rounded-md border border-transparent bg-primary px-4 py-3 text-sm font-medium text-light shadow-sm transition-colors hover:bg-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
						>
							Request Access
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
