<script lang="ts">
	import { CODE_COLORS, displayName, type Code } from './codingTree';
	import type { CodingTreeState } from './codingTreeState.svelte';

	let {
		tree,
		code,
		onDelete
	}: {
		tree: CodingTreeState;
		code: Code;
		/** The page owns deletion, because it is the one that can offer the undo. */
		onDelete: (id: string) => void;
	} = $props();

	const trail = $derived(tree.ancestorsOf(code.id).toReversed());
	const children = $derived(tree.childrenOf(code.id));

	// Focus follows selection: selecting a code on the canvas is usually the
	// first half of "and rename it". Keyed on the id so it re-runs when the
	// reader clicks a different node, not on every keystroke.
	let nameField = $state<HTMLInputElement | null>(null);
	$effect(() => {
		const selected = code.id;
		if (selected) nameField?.focus();
	});
</script>

<aside class="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">
	<div class="border-b border-gray-100 px-4 py-3">
		{#if trail.length > 0}
			<nav class="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-400">
				{#each trail as ancestor, index (ancestor.id)}
					<button
						class="max-w-32 truncate hover:text-gray-700 hover:underline"
						onclick={() => (tree.selectedId = ancestor.id)}
					>
						{displayName(ancestor.name)}
					</button>
					{#if index < trail.length - 1}<span>/</span>{/if}
				{/each}
			</nav>
		{/if}
		<label class="block">
			<span class="sr-only">Code name</span>
			<input
				bind:this={nameField}
				class="w-full rounded border-0 px-0 text-lg font-semibold text-gray-800 focus:ring-0"
				value={code.name}
				placeholder="Untitled code"
				oninput={(event) =>
					tree.patch(code.id, { name: event.currentTarget.value }, `name:${code.id}`)}
				onblur={() => tree.endEdit()}
			/>
		</label>
	</div>

	<div class="space-y-5 px-4 py-4">
		<label class="block">
			<span class="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Definition
			</span>
			<!-- The inclusion rule, not a description: this is what a second coder
			     reads before deciding whether a passage belongs here. -->
			<textarea
				class="w-full resize-y rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
				rows="4"
				value={code.definition}
				placeholder="What counts as this code? What does not?"
				oninput={(event) =>
					tree.patch(code.id, { definition: event.currentTarget.value }, `def:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Memo
			</span>
			<!-- Kept apart from the definition on purpose. The definition is a rule
			     others apply; the memo is the analyst's own thinking about it, and
			     mixing the two is how codebooks become unusable to a second coder. -->
			<textarea
				class="w-full resize-y rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
				rows="3"
				value={code.memo}
				placeholder="Why this code exists, what it borders on, what you are unsure about."
				oninput={(event) =>
					tree.patch(code.id, { memo: event.currentTarget.value }, `memo:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>

		<div>
			<span class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Branch colour
			</span>
			<div class="flex flex-wrap gap-2">
				{#each CODE_COLORS as color (color)}
					<button
						class="h-6 w-6 rounded-full ring-offset-2 transition {code.color === color
							? 'ring-2 ring-gray-400'
							: 'hover:ring-2 hover:ring-gray-200'}"
						style:background-color={color}
						aria-label="Colour this branch {color}"
						aria-pressed={code.color === color}
						onclick={() => tree.recolorBranch(code.id, color)}
					></button>
				{/each}
			</div>
			<p class="mt-2 text-[11px] text-gray-400">Applies to this code and everything under it.</p>
		</div>

		{#if children.length > 0}
			<div>
				<span class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					Sub-codes
				</span>
				<ul class="space-y-1">
					{#each children as child (child.id)}
						<li>
							<button
								class="w-full truncate rounded px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
								onclick={() => (tree.selectedId = child.id)}
							>
								{displayName(child.name)}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="mt-auto space-y-2 border-t border-gray-100 px-4 py-3">
		<button
			class="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
			onclick={() => tree.addChild(code.id)}
		>
			<i class="fas fa-plus mr-1"></i> Add sub-code
		</button>
		{#if code.parentId !== null}
			<button
				class="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
				onclick={() => tree.moveUnder(code.id, null)}
			>
				<i class="fas fa-arrow-turn-up mr-1"></i> Make top-level
			</button>
		{/if}
		<button
			class="w-full rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
			onclick={() => onDelete(code.id)}
		>
			<i class="fas fa-trash mr-1"></i>
			Delete{children.length > 0 ? ' with sub-codes' : ''}
		</button>
	</div>
</aside>
