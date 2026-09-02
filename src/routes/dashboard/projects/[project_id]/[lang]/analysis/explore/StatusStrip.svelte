<script lang="ts">
	import { Analysis } from '$lib/api';
	import type { EmbeddingStatus } from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { format } from 'd3-format';
	import { toast } from 'svelte-sonner';
	import { KINDS } from './explore';

	let {
		status,
		projectId,
		canBackfill,
		onstatus
	}: {
		status: EmbeddingStatus;
		projectId: string;
		/** Backfill is an editor's action; a viewer is not shown a button the API would refuse. */
		canBackfill: boolean;
		onstatus: (next: EmbeddingStatus) => void;
	} = $props();

	const formatNumber = format(',');

	let running = $state(false);

	// Navigating away mid-backfill must stop the poll: it runs for up to two
	// minutes, and nothing is watching it once the page is gone.
	let gone = false;
	$effect(() => () => {
		gone = true;
	});

	/** How often to re-read status while a backfill drains, and for how long. */
	const POLL_MS = 3000;
	const POLL_LIMIT = 40;

	let coverage = $derived(
		KINDS.map((kind) => ({ label: kind.label, count: status.coverage?.[kind.value] ?? 0 })).filter(
			(entry) => entry.count > 0
		)
	);

	async function backfill() {
		running = true;
		const { data, error } = await Analysis.triggerEmbeddingBackfill({
			path: { project_id: projectId }
		});

		if (error || !data) {
			running = false;
			toast.error('Could not start the backfill');
			return;
		}

		if (data.failed_interviews?.length) {
			// Surfaced rather than swallowed: an interview whose history cannot be
			// reconstructed is a data problem somebody has to look at, and it will
			// be reported again on every run until they do.
			toast.warning(
				`${data.failed_interviews.length} interview${data.failed_interviews.length === 1 ? '' : 's'} could not be embedded`
			);
		}

		if (data.queued === 0) {
			// The backfill is idempotent — a chunk whose text and model have not
			// changed is never queued — so nothing to do is the normal answer for a
			// project that is already covered, not a failure.
			running = false;
			toast.success('Everything is already embedded');
			return;
		}

		toast.success(`Embedding ${formatNumber(data.queued)} chunks`);
		poll();
	}

	/**
	 * Watch the queue drain. `queue_depth` is process-wide rather than per
	 * project, so it reaching zero means the server is idle rather than that
	 * this project in particular is done — close enough to tell the reader when
	 * to expect fresh results, and the only signal the API offers.
	 */
	async function poll() {
		for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, POLL_MS));
			if (gone) return;
			const { data } = await Analysis.getEmbeddingStatus({ path: { project_id: projectId } });
			if (gone) return;
			if (!data) continue;
			onstatus(data);
			if ((data.queue_depth ?? 0) === 0) break;
		}
		running = false;
	}
</script>

<div
	class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs text-gray-500"
>
	<span class="flex items-center gap-2 font-medium text-gray-700">
		<span
			class="inline-block h-2 w-2 rounded-full"
			class:bg-green-500={status.healthy}
			class:bg-amber-500={!status.healthy}
		></span>
		{status.healthy ? 'Embedding server up' : 'Embedding server unreachable'}
	</span>

	{#each coverage as entry (entry.label)}
		<span
			><span class="font-medium text-gray-700">{formatNumber(entry.count)}</span>
			{entry.label.toLowerCase()}</span
		>
	{/each}

	{#if (status.queue_depth ?? 0) > 0}
		<span>{formatNumber(status.queue_depth ?? 0)} queued</span>
	{/if}

	{#if (status.queue_dropped ?? 0) > 0}
		<span class="flex items-center gap-1 text-amber-700">
			{formatNumber(status.queue_dropped ?? 0)} dropped
			<HoverInfo
				text="Chunks the live queue could not take while the server was busy or down. Nothing is lost — a backfill re-derives them — but until one runs, search is behind the transcripts."
				iconColor="amber-500"
				iconHoverColor="amber-700"
			/>
		</span>
	{/if}

	<span class="ml-auto flex items-center gap-3">
		<span class="font-mono text-[0.6875rem] text-gray-400">{status.model}</span>
		{#if canBackfill}
			<button
				type="button"
				onclick={backfill}
				disabled={running}
				class="rounded-md border border-gray-200 px-2.5 py-1 font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{running ? 'Embedding…' : 'Re-embed project'}
			</button>
		{/if}
	</span>
</div>
