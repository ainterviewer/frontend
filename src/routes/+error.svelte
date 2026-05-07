<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ErrorPage from '$lib/components/ErrorPage.svelte';

	const description = $derived(
		page.status === 404
			? 'The page you are looking for does not exist or has been moved.'
			: 'We encountered an unexpected error. Please try again later.'
	);
</script>

<svelte:head>
	<title>{page.status} - AInterviewer</title>
</svelte:head>

<ErrorPage
	status={page.status}
	heading={page.error?.message || 'Something went wrong'}
	{description}
	homeHref={resolve('/')}
/>
