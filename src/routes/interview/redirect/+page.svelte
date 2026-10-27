<script lang="ts">
	/**
	 * An experiment's shared link, `/interview/redirect?id=<experiment>`.
	 *
	 * The backend gives the respondent a project and sets up their browser for
	 * it -- the `respondent` cookie and, when they have one to resume, the
	 * interview cookie -- so this calls it from the browser rather than from
	 * the server, where those cookies would never reach the respondent. The
	 * project is never taken from the link: it is decided and kept server-side.
	 */
	import { onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Interviews } from '$lib/api';

	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	let state = $state<'entering' | 'invalid' | 'closed' | 'unavailable'>('entering');

	onMount(async () => {
		const experiment_id = page.url.searchParams.get('id');
		if (!experiment_id || !UUID.test(experiment_id)) {
			state = 'invalid';
			return;
		}

		const { data, response } = await Interviews.enterExperiment({
			path: { experiment_id },
			body: { pid: page.url.searchParams.get('pid') }
		});
		if (!data) {
			state =
				response?.status === 404 ? 'invalid' : response?.status === 409 ? 'closed' : 'unavailable';
			return;
		}

		// Everything else on the link -- a language, a pid, external params --
		// is meant for the interview, so it travels on with the respondent.
		const target = new URLSearchParams([
			['id', data.project_id],
			...[...page.url.searchParams].filter(([key]) => key !== 'id')
		]);
		await goto(resolve(`/interview?${target}`), { replaceState: true });
	});
</script>

<div class="flex h-dvh w-full flex-col bg-white pb-[env(safe-area-inset-bottom)]">
	<h1
		class="mx-auto mt-2 w-fit bg-[url('/svgs/underline-main.svg')] bg-size-[100%_25px] bg-bottom bg-no-repeat pb-5 text-center text-3xl font-bold text-dark lg:mt-6 lg:pb-8"
	>
		AInterviewer
	</h1>

	<div class="flex flex-1 items-center justify-center px-6">
		<div class="max-w-md text-center">
			{#if state === 'entering'}
				<i class="fa-solid fa-spinner animate-spin text-2xl text-gray-400" aria-label="Loading"></i>
			{:else if state === 'closed'}
				<h2 class="mb-2 text-lg font-semibold text-gray-900">This study is not open right now</h2>
				<p class="text-sm text-gray-600">
					It is not accepting responses at the moment. Please try the link again later, or contact
					the person who shared it with you.
				</p>
			{:else if state === 'invalid'}
				<h2 class="mb-2 text-lg font-semibold text-gray-900">This link is not valid</h2>
				<p class="text-sm text-gray-600">
					Please check that you copied the whole link, or contact the person who shared it with you.
				</p>
			{:else}
				<h2 class="mb-2 text-lg font-semibold text-gray-900">Something went wrong</h2>
				<p class="text-sm text-gray-600">
					The study could not be reached. Please try the link again in a moment.
				</p>
			{/if}
		</div>
	</div>
</div>
