<script lang="ts">
	import type { Peer } from './guideSession.svelte';

	/** Who else has the guide open: one initial each, in their colour. */
	let { peers, max = 5 }: { peers: Peer[]; max?: number } = $props();

	const shown = $derived(peers.slice(0, max));
	const more = $derived(peers.length - shown.length);

	function initials(name: string) {
		const parts = name.trim().split(/\s+/);
		return (
			(parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
		).toUpperCase();
	}
</script>

{#if peers.length > 0}
	<div class="flex items-center -space-x-1.5" aria-label="Also editing">
		{#each shown as peer (peer.id)}
			<span
				class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
				style:background-color={peer.color}
				title={`${peer.name} is here`}
			>
				{initials(peer.name) || '?'}
			</span>
		{/each}
		{#if more > 0}
			<span
				class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 ring-2 ring-white"
				title={peers
					.slice(max)
					.map((p) => p.name)
					.join(', ')}
			>
				+{more}
			</span>
		{/if}
	</div>
{/if}
