<script lang="ts">
	import { Popover } from 'bits-ui';

	import type { ContentError } from '$lib/api';
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	import type { ContentSession } from './contentSession.svelte';
	import { reveal } from './reveal';

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
		 * in the panel it opens. */
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

	let errorsOpen = $state(false);

	/** Where an error is, as the DOM id of the block it is in, if it says. */
	function target(error: ContentError): string | null {
		return error.question_id ?? error.section_id ?? null;
	}

	function goTo(error: ContentError) {
		const id = target(error);
		if (!id) return;
		errorsOpen = false;
		reveal(id, error.field ?? null);
	}

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
	<HoverInfo
		side="bottom"
		sideOffset={12}
		text="Your changes are kept in this tab and saved when the connection is back. Do not close it."
		asChild
	>
		{#snippet children({ props })}
			<span
				{...props}
				class="flex h-4 cursor-default items-center gap-1.5 text-xs leading-none text-amber-700"
			>
				<i class="fas fa-plug-circle-xmark w-3 text-center"></i>
				Offline, reconnecting…
			</span>
		{/snippet}
	</HoverInfo>
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
	<!-- A popover, not a tooltip: the errors are links to where they are, and
	     a tooltip closes as the pointer heads for them. -->
	<Popover.Root bind:open={errorsOpen}>
		<Popover.Trigger
			class="flex h-4 cursor-pointer items-center gap-1.5 text-xs leading-none text-red-600 hover:text-red-700"
		>
			<i class="fas fa-triangle-exclamation w-3 text-center"></i>
			{invalidLabel}
			<i
				class={[
					'fas fa-chevron-down text-[0.6rem] transition-transform',
					errorsOpen && 'rotate-180'
				]}
			></i>
		</Popover.Trigger>
		<Popover.Portal>
			<!-- Anchored to this row, it is offset to the pill around it
			     (`CollabPill`: h-9 around this h-4 row, px-4): flush with the
			     pill's right edge, 8px below its bottom. -->
			<Popover.Content
				side="bottom"
				align="end"
				sideOffset={18}
				alignOffset={-16}
				class="z-1001 w-80 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md outline-none"
			>
				<p class="text-gray-600">
					Your changes are kept, but they won't be used in tests or published until this is fixed.
				</p>
				{#if session.errors.length > 0}
					<ul class="mt-2 space-y-1 border-t border-gray-100 pt-2">
						{#each session.errors as error, i (i)}
							<li>
								{#if target(error)}
									<button
										type="button"
										class="group flex w-full cursor-pointer gap-2 rounded px-1.5 py-1 text-left hover:bg-gray-50"
										onclick={() => goTo(error)}
									>
										{@render problem(error)}
										<i
											class="fas fa-arrow-right mt-0.5 ml-auto text-gray-300 group-hover:text-primary"
											aria-hidden="true"
										></i>
									</button>
								{:else}
									<div class="flex gap-2 px-1.5 py-1">{@render problem(error)}</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{/if}

{#snippet problem(error: ContentError)}
	<i class="fas fa-circle-exclamation mt-0.5 text-red-500"></i>
	<span>
		<span class="block font-medium text-gray-900">{error.message}</span>
		{#if error.fix}
			<span class="mt-0.5 block text-gray-500">{error.fix}</span>
		{/if}
	</span>
{/snippet}
