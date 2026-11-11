<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';

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
			{@const clickable = !!(onselect && peer.block)}
			<HoverInfo side="bottom" sideOffset={8} asChild>
				{#snippet content()}
					{clickable ? `Go to where ${peer.name} is` : `${peer.name} is here`}
				{/snippet}
				{#snippet children({ props })}
					{#if clickable}
						<button
							{...props}
							type="button"
							class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none p-0 text-[11px] font-semibold text-white ring-2 ring-white transition-transform hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							style:background-color={peer.color}
							aria-label={`Go to where ${peer.name} is`}
							onclick={() => onselect?.(peer)}
						>
							{initials(peer.name) || '?'}
						</button>
					{:else}
						<span
							{...props}
							class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
							style:background-color={peer.color}
							aria-label={`${peer.name} is here`}
						>
							{initials(peer.name) || '?'}
						</span>
					{/if}
				{/snippet}
			</HoverInfo>
		{/each}
		{#if more > 0}
			<HoverInfo side="bottom" sideOffset={8} asChild>
				{#snippet content()}
					{peers
						.slice(max)
						.map((p) => p.name)
						.join(', ')}
				{/snippet}
				{#snippet children({ props })}
					<span
						{...props}
						class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 ring-2 ring-white"
					>
						+{more}
					</span>
				{/snippet}
			</HoverInfo>
		{/if}
	</div>
{/if}
