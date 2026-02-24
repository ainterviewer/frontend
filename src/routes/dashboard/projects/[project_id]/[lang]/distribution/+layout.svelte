<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let isDemo = $derived(page.data.user?.scope === 'demo');
	let isMonitor = $derived(page.url.pathname.endsWith('/monitor'));
</script>

{#if isDemo}
	<div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-500/50">
		<div class="rounded-lg bg-white px-6 py-4 text-center shadow-lg">
			<p class="text-lg font-semibold text-gray-800">
				{isMonitor ? 'Monitoring unavailable' : 'Distribution unavailable'}
			</p>
			<p class="mt-1 text-sm text-gray-600">
				{isMonitor
					? 'You cannot monitor interviews with your current demo access.'
					: 'You cannot distribute interviews with your current demo access.'}
			</p>
		</div>
	</div>
{/if}

{@render children()}
