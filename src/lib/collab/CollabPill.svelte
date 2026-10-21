<script lang="ts">
	import type { ContentSession, Peer } from './contentSession.svelte';
	import PresenceAvatars from './PresenceAvatars.svelte';
	import SyncState from './SyncState.svelte';

	/**
	 * Who else is here and whether it is all saved, as two pills side by side:
	 * pinned to the window's top right, a little under the header (2.75rem),
	 * clear of the pane's scrollbar, so they stay put however far the page
	 * scrolls. The same on every page edited live.
	 */
	let { session, invalidLabel }: { session: ContentSession; invalidLabel?: string } = $props();

	/**
	 * To the block someone is in, which their ring already marks. Centred,
	 * since the top of the pane is under this pill.
	 */
	function goTo(peer: Peer) {
		if (!peer.block) return;
		document.getElementById(peer.block)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}
</script>

<!-- Two pills, not one: who is here comes and goes, and folding it into the
     save state made that pill grow and shrink under the reader's eye. The tour
     points at the row, since its step covers both. -->
<div
	data-tour="sync-state"
	class="fixed top-[4.25rem] right-7.5 z-30 flex items-center gap-2 print:hidden"
>
	{#if session.peers.length > 0}
		<div
			class="flex h-9 items-center rounded-full border border-gray-200 bg-white/90 px-1 shadow-md backdrop-blur"
		>
			<PresenceAvatars peers={session.peers} onselect={goTo} />
		</div>
	{/if}
	<div
		class="flex h-9 items-center rounded-full border border-gray-200 bg-white/90 px-4 py-1 shadow-md backdrop-blur"
	>
		<SyncState {session} {invalidLabel} />
	</div>
</div>
