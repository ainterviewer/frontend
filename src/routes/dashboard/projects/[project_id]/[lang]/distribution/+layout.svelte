<script lang="ts">
	import { page } from '$app/state';
	import DemoRestrictionOverlay from '$lib/components/DemoRestrictionOverlay.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let isDemo = $derived(page.data.user?.scope === 'demo');
	let isMonitor = $derived(page.url.pathname.endsWith('/monitor'));
</script>

{#if isDemo}
	<DemoRestrictionOverlay
		title={isMonitor ? 'Monitoring unavailable' : 'Distribution unavailable'}
		description={isMonitor
			? 'You cannot monitor interviews with your current demo access.'
			: 'You cannot distribute interviews with your current demo access.'}
	/>
{/if}

{@render children()}
