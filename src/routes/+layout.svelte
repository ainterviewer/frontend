<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';
	import '$lib/api/toast-interceptor';

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
