<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Wave from '$lib/components/Wave.svelte';
</script>

<svelte:head>
	<title>{page.status} - AInterviewer</title>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-light text-center"
>
	<div class="z-10 px-4">
		<Wave className="size-20 mx-auto" animate={true} color="#196858" />

		<h1 class="text-9xl font-bold text-primary">{page.status}</h1>

		<h2 class="mt-4 text-3xl font-bold text-dark">
			{page.error?.message || 'Something went wrong'}
		</h2>

		<p class="mx-auto mt-4 max-w-md text-lg text-gray-600">
			{#if page.status === 404}
				The page you are looking for does not exist or has been moved.
			{:else}
				We encountered an unexpected error. Please try again later.
			{/if}
		</p>

		<a
			href={resolve('/')}
			class="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
		>
			Go back home
		</a>
	</div>

	<!-- Background decoration -->
	<div class="pointer-events-none absolute right-0 bottom-0 left-0 h-64 w-full opacity-10"></div>
</div>
