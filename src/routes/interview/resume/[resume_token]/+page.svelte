<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Interviews } from '$lib/api';
	import Wave from '$lib/components/Wave.svelte';
	import { saveInterviewSession } from '../../chat.svelte';

	// Nothing happens on arrival, deliberately. The link is single-use, and
	// corporate mail security (Outlook Safe Links and friends) pre-fetches URLs
	// out of email before the recipient clicks. Redeeming on load would let a
	// scanner spend the link and strand the respondent it was issued for, so
	// redemption waits for the button — scanners follow GETs, not form posts.
	const resumeToken = $derived(page.params.resume_token as string);

	let isLoading = $state(false);
	let errorMessage = $state('');

	async function handleResume(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		const { data, error: apiError } = await Interviews.redeemInterviewResumeLink({
			path: { resume_token: resumeToken }
		});

		if (apiError || !data) {
			isLoading = false;
			errorMessage =
				typeof apiError === 'object' && apiError && 'detail' in apiError
					? String((apiError as { detail: unknown }).detail)
					: 'This link is no longer valid. Please ask for a new one.';
			return;
		}

		// The interview page reads which interview to reconnect to out of the
		// httponly cookie the redeem response just set, so nothing identifying
		// needs to travel in this URL. The stored entry is only a fallback for
		// the existing reconnect path.
		saveInterviewSession(data.project_id, data.interview_id);
		await goto(resolve(`/interview?id=${data.project_id}`));
	}
</script>

<svelte:head>
	<title>Continue your interview - AInterviewer</title>
	<!-- A live credential sits in this URL; keep it out of search indexes and
	     out of the referer header of anything the next page loads. -->
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-light px-4 py-12"
>
	<div class="z-10 w-full max-w-lg">
		<div class="flex items-center justify-center gap-4">
			<Wave className="size-12" animate={true} color="#196858" />
			<h1 class="text-4xl font-bold text-primary">Continue</h1>
		</div>

		<div class="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg sm:p-10">
			<h2 class="text-2xl font-bold text-dark">Pick up where you left off</h2>
			<p class="mt-3 text-base text-gray-600">
				You have an interview in progress. Continue below and you'll return to it with your earlier
				answers already recorded.
			</p>
			<p class="mt-3 text-base text-gray-600">
				This link works <span class="font-medium text-dark">once</span> and is meant only for you — please
				don't forward it.
			</p>

			<form onsubmit={handleResume} class="mt-6 space-y-5">
				{#if errorMessage}
					<div class="rounded-md border border-red-200 bg-red-50 p-3">
						<h3 class="text-sm font-medium text-red-800">{errorMessage}</h3>
					</div>
				{/if}

				<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
					<button
						type="submit"
						disabled={isLoading}
						class="inline-flex justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isLoading ? 'Opening your interview...' : 'Continue my interview'}
					</button>
				</div>
			</form>
		</div>
	</div>

	<div class="pointer-events-none absolute right-0 bottom-0 left-0 h-64 w-full opacity-10"></div>
</div>
