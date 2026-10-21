<script lang="ts">
	import type { Peer } from './contentSession.svelte';

	/**
	 * Who else has the guide open: one initial each, in their colour. Someone
	 * who is in a block can be clicked, which hands them to `onselect` -- the
	 * pill takes the reader there.
	 */
	let {
		peers,
		max = 5,
		onselect
	}: { peers: Peer[]; max?: number; onselect?: (peer: Peer) => void } = $props();

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
			{#if onselect && peer.block}
				<button
					type="button"
					class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none p-0 text-[11px] font-semibold text-white ring-2 ring-white transition-transform hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					style:background-color={peer.color}
					title={`Go to where ${peer.name} is`}
					aria-label={`Go to where ${peer.name} is`}
					onclick={() => onselect(peer)}
				>
					{initials(peer.name) || '?'}
				</button>
			{:else}
				<span
					class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
					style:background-color={peer.color}
					title={`${peer.name} is here`}
				>
					{initials(peer.name) || '?'}
				</span>
			{/if}
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
