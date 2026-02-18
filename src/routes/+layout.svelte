<script lang="ts">
	import '$lib/api-extra/toast-interceptor';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>AInterviewer - AI-led Qualitative Interviews</title>
</svelte:head>

<Toaster position="top-center" richColors closeButton />

<div>
	{@render children()}
</div>
