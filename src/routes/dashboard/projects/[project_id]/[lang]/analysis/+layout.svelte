<script lang="ts">
	import type { Snippet } from 'svelte';

	import { page } from '$app/state';
	import DemoRestrictionOverlay from '$lib/components/DemoRestrictionOverlay.svelte';

	let { children }: { children: Snippet } = $props();

	let isDemo = $derived(page.data.user?.scope === 'demo');
</script>

<!-- The backend refuses demo accounts the analysis routes; `demo-interceptor`
	holds those refusals here, so the pages beneath stay on their skeletons. -->
{#if isDemo}
	<DemoRestrictionOverlay
		title="Analysis unavailable"
		description="You cannot analyse interviews with your current demo access."
	/>
{/if}

{@render children()}
