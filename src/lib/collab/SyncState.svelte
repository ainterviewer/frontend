<script lang="ts">
	import type { ContentSession } from './contentSession.svelte';

	/**
	 * Whether what is on screen is saved. Quiet while it is, which is almost
	 * always; loud only when the reader has to know: the connection is gone (their
	 * changes exist only in this tab until it comes back) or what is written is
	 * invalid. Invalid is not unsaved: the edits are kept, but tests and
	 * publishing go on using the last valid version until it is fixed.
	 *
	 * One `flex` row of fixed height, the icon in a column of its own. "Saved"
	 * and "Saving", which alternate as people type, sit in one grid cell, so the
	 * row is as wide as the wider of them whichever shows: the pill it is in
	 * never shifts. The rest are rare, and may widen it.
	 */
	let {
		session,
		invalidLabel = 'Invalid: fix the errors'
	}: {
		session: ContentSession;
		/** What to say while what editors wrote is invalid; the reasons are
		 * in its tooltip. */
		invalidLabel?: string;
	} = $props();

	type Quiet = 'saving' | 'saved';

	const QUIET: { state: Quiet; label: string }[] = [
		{ state: 'saved', label: 'Saved' },
		{ state: 'saving', label: 'Saving' }
	];

	const ICONS: Record<Quiet, string> = {
		saved: 'fa-check',
		saving: 'fa-circle-notch animate-spin'
	};

	/** Faded, so the pill tells saved from not-yet at a glance without
	 * competing with the page; the loud states below stay full strength. */
	const COLORS: Record<Quiet, string> = {
		saved: 'text-primary/70',
		saving: 'text-red-600/60'
	};

	let quiet = $derived<Quiet | null>(
		session.status !== 'synced' || session.errors.length > 0
			? null
			: session.unsaved
				? 'saving'
				: 'saved'
	);
</script>

{#if session.status === 'refused'}
	<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600">
		<i class="fas fa-lock w-3 text-center"></i>
		Not connected. Reload the page to try again.
	</span>
{:else if session.status === 'offline'}
	<span
		class="flex h-4 items-center gap-1.5 text-xs leading-none text-amber-700"
		title="Your changes are kept in this tab and saved when the connection is back. Do not close it."
	>
		<i class="fas fa-plug-circle-xmark w-3 text-center"></i>
		Offline, reconnecting…
	</span>
{:else if session.status === 'connecting'}
	<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-gray-400">
		<i class="fas fa-circle-notch w-3 animate-spin text-center"></i>
		Connecting
	</span>
{:else if quiet}
	<span class={['flex h-4 items-center gap-1.5 text-xs leading-none', COLORS[quiet]]}>
		<i class="fas {ICONS[quiet]} w-3 text-center"></i>
		<span class="grid">
			{#each QUIET as { state, label } (state)}
				<span
					class={['col-start-1 row-start-1 whitespace-nowrap', state !== quiet && 'invisible']}
					aria-hidden={state !== quiet}
				>
					{label}
				</span>
			{/each}
		</span>
	</span>
{:else}
	<span
		class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600"
		title={[
			"Your changes are kept, but they won't be used in tests or published until this is fixed.",
			...session.errors
		].join('\n')}
	>
		<i class="fas fa-triangle-exclamation w-3 text-center"></i>
		{invalidLabel}
	</span>
{/if}
