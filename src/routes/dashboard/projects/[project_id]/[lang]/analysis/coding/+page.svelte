<script lang="ts">
	import CodebookGate from '$lib/coding/CodebookGate.svelte';
	import SaveState from '$lib/coding/SaveState.svelte';
	import { codebookFor } from '$lib/coding/store.svelte';
	import CodingWorkspace from './CodingWorkspace.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The project's codebook rather than this page's: the explore page's code
	// pane edits the same tree, and navigating between the two must not fork it.
	// Keyed by project alone -- a codebook spans a project's languages, because
	// the point of one is that the same codes reach every transcript.
	const book = $derived(codebookFor(data.project_id));
</script>

<div class="flex min-h-0 w-full flex-1 flex-col">
	<header class="mb-4 flex items-start justify-between gap-4">
		<div>
			<h1 class="page-title">Coding tree</h1>
			<p class="text-sm text-gray-500">
				The project's codebook as a tree. Drag a code onto another to make it a sub-code; under Free
				layout dragging arranges instead, and a code is re-parented by dragging from its handle to
				the one it should sit under. A code moved into another branch takes that branch's colour.
				Select a code to write its definition and memo.
			</p>
		</div>
		<div class="shrink-0 pt-1"><SaveState {book} /></div>
	</header>

	<!-- Keyed, because the gate's saving effect and the workspace's canvas are
	     both built around one codebook; switching projects has to rebuild them
	     rather than re-point them. -->
	{#key book}
		<CodebookGate {book}>
			{#snippet children(tree)}
				<CodingWorkspace {tree} />
			{/snippet}
		</CodebookGate>
	{/key}
</div>
