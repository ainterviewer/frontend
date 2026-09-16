<script lang="ts">
	import { isApplicable } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';

	let { tree }: { tree: CodingTreeState } = $props();

	const codeCount = $derived(tree.codes.length);
	// Groups are not counted: the warning means "nobody else could apply this",
	// and nothing is ever applied to a group, so asking it for an inclusion rule
	// would report a gap that is not one.
	const undefinedCount = $derived(
		tree.codes.filter((code) => isApplicable(code) && code.definition.trim() === '').length
	);
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
	<button
		class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:opacity-90"
		onclick={() => tree.addRootCode()}
	>
		<i class="fas fa-plus mr-1"></i> New code
	</button>

	<div class="mx-1 h-5 w-px bg-gray-200"></div>

	<button
		class="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
		disabled={!tree.canUndo}
		title="Undo (Ctrl+Z)"
		onclick={() => tree.undo()}
	>
		<i class="fas fa-rotate-left"></i>
	</button>
	<button
		class="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
		disabled={!tree.canRedo}
		title="Redo (Ctrl+Shift+Z)"
		onclick={() => tree.redo()}
	>
		<i class="fas fa-rotate-right"></i>
	</button>

	<div class="mx-1 h-5 w-px bg-gray-200"></div>

	<!-- The hybrid: the layout arranges the tree until the reader decides it
	     should not. Breaking out keeps whatever is on screen, so the toggle is
	     never a jump. -->
	<div class="flex overflow-hidden rounded border border-gray-200 text-sm">
		{#each [{ mode: 'auto', label: 'Auto layout' }, { mode: 'free', label: 'Free' }] as const as option (option.mode)}
			<button
				class="px-3 py-1 {tree.layoutMode === option.mode
					? 'bg-gray-800 text-white'
					: 'text-gray-600 hover:bg-gray-50'}"
				aria-pressed={tree.layoutMode === option.mode}
				onclick={() => tree.setLayoutMode(option.mode)}
			>
				{option.label}
			</button>
		{/each}
	</div>

	<button
		class="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
		title={tree.direction === 'TB' ? 'Switch to left-to-right' : 'Switch to top-down'}
		onclick={() => tree.setDirection(tree.direction === 'TB' ? 'LR' : 'TB')}
	>
		<i class="fas {tree.direction === 'TB' ? 'fa-arrow-down' : 'fa-arrow-right'}"></i>
	</button>

	{#if tree.layoutMode === 'free'}
		<button
			class="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
			title="Forget hand-placed positions and lay the tree out again"
			onclick={() => tree.resetPositions()}
		>
			<i class="fas fa-wand-magic-sparkles mr-1"></i> Tidy up
		</button>
	{/if}

	<div class="ml-auto flex items-center gap-3 text-xs text-gray-400">
		<span>{codeCount} code{codeCount === 1 ? '' : 's'}</span>
		{#if undefinedCount > 0}
			<span class="text-amber-600">{undefinedCount} without a definition</span>
		{/if}
	</div>
</div>
