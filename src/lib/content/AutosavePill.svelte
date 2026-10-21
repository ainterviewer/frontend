<script lang="ts">
	import type { Autosaver, AutosaveState } from './autosave.svelte';

	/**
	 * Whether a page that saves itself has saved: the same pill, in the same
	 * place, as the pages edited live (`$lib/collab/CollabPill.svelte`). Quiet
	 * while it is saved or saving; loud only when the reader has to act.
	 *
	 * Over several savers (the two participant emails) it shows the most
	 * urgent state of any of them, and its actions act on that one.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any page's saver
	let { savers }: { savers: Autosaver<any>[] } = $props();

	const URGENCY: AutosaveState[] = ['conflict', 'failed', 'invalid', 'saving', 'pending', 'saved'];

	let saver = $derived(
		[...savers].sort((a, b) => URGENCY.indexOf(a.state) - URGENCY.indexOf(b.state))[0]
	);
	let quiet = $derived<'saved' | 'saving' | null>(
		saver.state === 'saved'
			? 'saved'
			: saver.state === 'saving' || saver.state === 'pending'
				? 'saving'
				: null
	);
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (savers.some((s) => s.unsaved)) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

<div
	class="fixed top-[3.75rem] right-6 z-30 flex h-9 items-center gap-3 rounded-full border border-gray-200 bg-white/90 py-1 pr-4 pl-4 shadow-md backdrop-blur print:hidden"
>
	{#if quiet}
		<!-- Faded primary and red, the same as the live pages' `SyncState`. -->
		<span
			class={[
				'flex h-4 items-center gap-1.5 text-xs leading-none',
				quiet === 'saved' ? 'text-primary/70' : 'text-red-600/60'
			]}
		>
			<i
				class={[
					'fas w-3 text-center',
					quiet === 'saved' ? 'fa-check' : 'fa-circle-notch animate-spin'
				]}
			></i>
			<!-- Both in one cell, so the pill is as wide as the wider whichever
			     shows and never shifts as they alternate. -->
			<span class="grid">
				{#each ['saved', 'saving'] as const as state (state)}
					<span
						class={['col-start-1 row-start-1 whitespace-nowrap', state !== quiet && 'invisible']}
						aria-hidden={state !== quiet}
					>
						{state === 'saved' ? 'Saved' : 'Saving'}
					</span>
				{/each}
			</span>
		</span>
	{:else if saver.state === 'conflict'}
		<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600">
			<i class="fas fa-triangle-exclamation w-3 text-center"></i>
			Someone else changed this page
			<button
				type="button"
				class="ml-1 cursor-pointer underline underline-offset-2 hover:no-underline"
				onclick={() => saver.loadTheirs()}
			>
				Load theirs
			</button>
			<button
				type="button"
				class="cursor-pointer underline underline-offset-2 hover:no-underline"
				title="Save your version over theirs"
				onclick={() => saver.keepMine()}
			>
				Keep mine
			</button>
		</span>
	{:else if saver.state === 'invalid'}
		<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600">
			<i class="fas fa-triangle-exclamation w-3 text-center"></i>
			{saver.message}
		</span>
	{:else}
		<span class="flex h-4 items-center gap-1.5 text-xs leading-none text-red-600">
			<i class="fas fa-triangle-exclamation w-3 text-center"></i>
			{saver.message ?? 'Not saved'}
			<button
				type="button"
				class="ml-1 cursor-pointer underline underline-offset-2 hover:no-underline"
				onclick={() => saver.flush()}
			>
				Retry
			</button>
		</span>
	{/if}
</div>
