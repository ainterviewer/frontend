<script lang="ts">
	import type { Snippet } from 'svelte';

	import { page } from '$app/state';
	import DemoRestrictionOverlay from '$lib/components/DemoRestrictionOverlay.svelte';

	let { children }: { children: Snippet } = $props();

	let isDemo = $derived(page.data.user?.scope === 'demo');
</script>

<!-- Over the list and the transcripts alike. The backend refuses demo
	accounts distributed interviews; `demo-interceptor` holds those refusals
	here, so the list stays on its skeleton. -->
{#if isDemo}
	<DemoRestrictionOverlay
		title="Interviews unavailable"
		description="You cannot view interviews with your current demo access."
	/>
{/if}

{@render children()}
