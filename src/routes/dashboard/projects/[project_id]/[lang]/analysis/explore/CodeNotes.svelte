<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { type Code, displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';

	let {
		tree,
		code,
		onclose
	}: {
		tree: CodingTreeState;
		/** The selected code. The pane is not rendered without one. */
		code: Code;
		onclose: () => void;
	} = $props();

	/**
	 * Two fields and not the rest of the inspector.
	 *
	 * The codebook page has the whole editor, and a second one of those would
	 * be two places to recolour a branch and two places to delete a code. What
	 * belongs *here* is the pair that is written while reading rather than
	 * while planning: the definition, because `Search by definition` turns it
	 * into a query and a bad query is worth fixing where you noticed it, and
	 * the memo, because the thinking it records happens in front of the
	 * evidence.
	 */
	/**
	 * Where the rest of the code lives — kind, colour, scale, deletion.
	 *
	 * Resolved here rather than handed in: `resolve` is what the lint rule
	 * looks for at the `href` itself, and a route built two components away is
	 * a route nothing can check. Null outside a router, which every test of the
	 * pane is — `resolve` throws on a missing parameter, so a link built
	 * unconditionally would take the pane down with it.
	 */
	const codebookHref = $derived.by(() => {
		const project_id = page.params.project_id;
		if (!project_id) return null;
		return { project_id, lang: page.params.lang ?? 'en' };
	});

	const placeholder = $derived(
		code.kind === 'score'
			? 'What is being rated, and what do the ends of the scale mean?'
			: code.kind === 'group'
				? 'What this part of the codebook is for.'
				: 'What counts as this code? What does not?'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex shrink-0 items-center gap-1.5 px-2 py-1">
		<span
			class="h-1.5 w-1.5 shrink-0 rounded-full"
			style:background-color={code.color}
			aria-hidden="true"
		></span>
		<h3 class="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-gray-800">
			{displayName(code.name)}
		</h3>
		<!-- The rest of the code is a route away, and said so rather than
		     rebuilt: kind, colour and the scale's ends are decisions about the
		     codebook, not notes taken while reading it. -->
		{#if codebookHref}
			<a
				href={resolve('/dashboard/projects/[project_id]/[lang]/analysis/codebook', codebookHref)}
				class="shrink-0 text-[0.625rem] text-primary underline-offset-2 hover:underline"
			>
				Open in codebook
			</a>
		{/if}
		<button
			type="button"
			onclick={onclose}
			aria-label="Close notes"
			class="shrink-0 cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
		>
			<i class="fa-solid fa-xmark text-[0.625rem]"></i>
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
		<label class="flex min-h-0 flex-1 flex-col">
			<span class="mb-0.5 block text-[0.625rem] font-medium tracking-wide text-gray-500 uppercase">
				Definition
			</span>
			<!-- The inclusion rule, not a description: this is what a second coder
			     reads before deciding whether a passage belongs here, and what
			     *Search by definition* sends as the query. -->
			<textarea
				class="min-h-[3.5rem] w-full flex-1 resize-none rounded border-gray-200 text-xs text-gray-700 focus:border-primary focus:ring-primary"
				value={code.definition}
				{placeholder}
				oninput={(event) =>
					tree.patch(code.id, { definition: event.currentTarget.value }, `def:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>

		<label class="flex min-h-0 flex-1 flex-col">
			<span class="mb-0.5 block text-[0.625rem] font-medium tracking-wide text-gray-500 uppercase">
				Memo
			</span>
			<!-- Kept apart from the definition on purpose. The definition is a rule
			     others apply; the memo is the analyst's own thinking about it, and
			     mixing the two is how codebooks become unusable to a second coder. -->
			<textarea
				class="min-h-[3.5rem] w-full flex-1 resize-none rounded border-gray-200 text-xs text-gray-700 focus:border-primary focus:ring-primary"
				value={code.memo}
				placeholder="Why this code exists, what it borders on, what you are unsure about."
				oninput={(event) =>
					tree.patch(code.id, { memo: event.currentTarget.value }, `memo:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>
	</div>
</div>
