<script lang="ts">
	import type { ContentSession } from './contentSession.svelte';
	import PresenceAvatars from './PresenceAvatars.svelte';
	import SyncState from './SyncState.svelte';

	/**
	 * Who else is here and whether it is all saved: pinned to the window's top
	 * right, just under the header (2.75rem), clear of the pane's scrollbar, so
	 * it stays put however far the page scrolls. The same on every page edited
	 * live.
	 */
	let { session, invalidLabel }: { session: ContentSession; invalidLabel?: string } = $props();
</script>

<div
	data-tour="sync-state"
	class={[
		'fixed top-[3.75rem] right-6 z-30 flex h-9 items-center gap-3 rounded-full border border-gray-200 bg-white/90 py-1 pr-4 shadow-md backdrop-blur print:hidden',
		session.peers.length > 0 ? 'pl-1' : 'pl-4'
	]}
>
	<PresenceAvatars peers={session.peers} />
	<SyncState {session} {invalidLabel} />
</div>
