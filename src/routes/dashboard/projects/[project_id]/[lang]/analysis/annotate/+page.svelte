<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import CodebookGate from '$lib/coding/CodebookGate.svelte';
	import { displayName, outlineOf, scoreRangeLabel } from '$lib/coding/codingTree';
	import { codebookFor } from '$lib/coding/store.svelte';
	import { getContrastColor } from '$lib/utils/colors';

	/**
	 * The codebook, and how much of the corpus each code has reached.
	 *
	 * Read-only on purpose: a codebook is edited on the Coding page, where the
	 * tree can be dragged about. What this page adds is the one thing that page
	 * cannot show -- the counts, which say which codes are carrying the analysis
	 * and which are still only an intention.
	 */

	let projectId = $derived(page.params.project_id ?? '');
	let lang = $derived(page.params.lang ?? '');

	const book = $derived(codebookFor(projectId));

	let counts = $state<Record<string, number>>({});

	$effect(() => {
		const project = projectId;
		if (!project) return;
		// Read afresh on every visit rather than cached with the codebook: the
		// counts change as people code, and a stale one reads as "nobody has
		// used this code" -- the single claim this page exists to make.
		void (async () => {
			const { data } = await Analysis.getCodeCounts({ path: { project_id: project } });
			if (data) counts = data;
		})();
	});
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold text-gray-800">Coding</h1>
	<div class="flex items-center gap-2">
		<a
			href={resolve(`/dashboard/projects/${projectId}/${lang}/analysis/coding`)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
		>
			<i class="fa-solid fa-sitemap mr-2"></i>
			Edit codebook
		</a>
		<a
			href={resolve(`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages`)}
			class="rounded-md bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-dark"
		>
			<i class="fa-solid fa-magnifying-glass mr-2"></i>
			Browse &amp; code messages
		</a>
	</div>
</div>

<p class="mb-6 max-w-2xl text-gray-600">
	The project's codebook, and how many passages each code has been applied to. A code's count is its
	own — a passage coded <em>Cost</em> is not thereby coded the group it sits under.
</p>

<CodebookGate {book}>
	{#snippet children(tree)}
		{@const rows = outlineOf(tree.codes)}
		{#if rows.length === 0}
			<div class="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center">
				<p class="mb-3 text-gray-600">This project has no codebook yet.</p>
				<a
					href={resolve(`/dashboard/projects/${projectId}/${lang}/analysis/coding`)}
					class="text-sm text-primary underline underline-offset-2"
				>
					Build one on the Coding page
				</a>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
				{#each rows as row (row.code.id)}
					{@const code = row.code}
					{@const used = counts[code.id] ?? 0}
					<div
						class="flex items-center gap-3 border-b border-gray-100 px-4 py-2 last:border-b-0 hover:bg-gray-50"
						style="padding-left: {16 + row.depth * 20}px"
					>
						<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {code.color}"
						></span>
						<span class="min-w-0 flex-1 truncate text-sm text-gray-800">
							{displayName(code.name)}
						</span>

						{#if code.kind === 'group'}
							<span class="shrink-0 text-[10px] tracking-wide text-gray-400 uppercase">Group</span>
						{:else if code.kind === 'score'}
							<span class="shrink-0 text-xs text-gray-400">{scoreRangeLabel(code)}</span>
						{/if}

						{#if code.kind === 'group'}
							<!-- A group is never applied, so it has no count and nothing to
							     browse. Saying "0" would read as "unused". -->
							<span class="w-28 shrink-0 text-right text-xs text-gray-300">—</span>
						{:else if used === 0}
							<span class="w-28 shrink-0 text-right text-xs text-gray-400">Not yet used</span>
						{:else}
							<a
								href={resolve(
									`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages?code_id=${code.id}`
								)}
								class="w-28 shrink-0 text-right text-xs text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
							>
								{used} passage{used === 1 ? '' : 's'}
							</a>
						{/if}

						<span
							class="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
							style="background-color: {code.color}; color: {getContrastColor(code.color)}"
							title={code.definition || undefined}
						>
							{code.kind}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	{/snippet}
</CodebookGate>
