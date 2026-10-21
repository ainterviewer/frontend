<script lang="ts">
	import type { ContentSession } from './contentSession.svelte';
	import PresenceAvatars from './PresenceAvatars.svelte';
	import SyncState from './SyncState.svelte';

	/**
	 * Who else is here and whether it is all saved, as two pills side by side:
	 * pinned to the window's top right, just under the header (2.75rem), clear
	 * of the pane's scrollbar, so they stay put however far the page scrolls.
	 * The same on every page edited live.
	 */
	let { session, invalidLabel }: { session: ContentSession; invalidLabel?: string } = $props();
</script>

<!-- Two pills, not one: who is here comes and goes, and folding it into the
     save state made that pill grow and shrink under the reader's eye. The tour
     points at the row, since its step covers both. -->
<div
	data-tour="sync-state"
	class="fixed top-[3.75rem] right-6 z-30 flex items-center gap-2 print:hidden"
>
	{#if session.peers.length > 0}
		<div
			class="flex h-9 items-center rounded-full border border-gray-200 bg-white/90 px-1 shadow-md backdrop-blur"
		>
			<PresenceAvatars peers={session.peers} />
		</div>
	{/if}
	<div
		class="flex h-9 items-center rounded-full border border-gray-200 bg-white/90 px-4 py-1 shadow-md backdrop-blur"
	>
		<SyncState {session} {invalidLabel} />
	</div>
</div>
