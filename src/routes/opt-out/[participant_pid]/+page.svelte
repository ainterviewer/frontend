<script lang="ts">
	import { Participants } from '$lib/api';
	import { page } from '$app/state';
	import Wave from '$lib/components/Wave.svelte';

	let reason = $state('');
	let isLoading = $state(false);
	let isSuccess = $state(false);
	let errorMessage = $state('');

	const participantPid = $derived(page.params.participant_pid);

	async function handleOptOut(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		const trimmedReason = reason.trim();
		const { error: apiError } = await Participants.optOut({
			path: { opt_out_token: participantPid },
			body: trimmedReason ? trimmedReason : null
		});

		isLoading = false;

		if (apiError) {
			errorMessage =
				typeof apiError === 'object' && apiError && 'detail' in apiError
					? String((apiError as { detail: unknown }).detail)
					: 'Failed to opt out. Please try again later.';
			return;
		}

		isSuccess = true;
	}
</script>

<svelte:head>
	<title>Opt out - AInterviewer</title>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-light px-4 py-12"
>
	<div class="z-10 w-full max-w-lg">
		<div class="flex items-center justify-center gap-4">
			<Wave className="size-12" animate={true} color="#196858" />
			<h1 class="text-4xl font-bold text-primary">Opt out</h1>
		</div>

		<div class="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg sm:p-10">
			{#if isSuccess}
				<div class="text-center">
					<h2 class="text-2xl font-bold text-dark">You've been opted out</h2>
					<p class="mt-3 text-base text-gray-600">
						Your data will no longer be used in this study and you won't be contacted again.
					</p>
				</div>
			{:else}
				<p class="text-base text-gray-600">
					Confirm that you want to opt out of this interview and stop being contacted about it in
					the future. <span class="font-medium text-dark">This cannot be undone.</span>
				</p>

				<form onsubmit={handleOptOut} class="mt-6 space-y-5">
					{#if errorMessage}
						<div class="rounded-md border border-red-200 bg-red-50 p-3">
							<h3 class="text-sm font-medium text-red-800">{errorMessage}</h3>
						</div>
					{/if}

					<div>
						<label for="reason" class="block text-sm font-medium text-gray-700">
							Reason (optional)
						</label>
						<textarea
							id="reason"
							name="reason"
							rows="4"
							bind:value={reason}
							placeholder="Let us know why you're opting out"
							class="mt-1 block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm"
						></textarea>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
						<button
							type="submit"
							disabled={isLoading}
							class="inline-flex justify-center rounded-md bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isLoading ? 'Opting out...' : 'Confirm opt out'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>

	<div class="pointer-events-none absolute right-0 bottom-0 left-0 h-64 w-full opacity-10"></div>
</div>
