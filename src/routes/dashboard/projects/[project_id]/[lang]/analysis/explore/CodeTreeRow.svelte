<script lang="ts">
	import { displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';
	import { kindMark, ROW_HEIGHT, type CodeRowLike } from './codeTable';
	import { useCodeDrag } from './codeTableDrag.svelte';
	import Self from './CodeTreeRow.svelte';

	let {
		row,
		tree,
		renamingId,
		isExpanded,
		ontoggle,
		onstartdrag,
		onrename
	}: {
		row: CodeRowLike;
		tree: CodingTreeState;
		/** The one code whose name is being typed, if any. */
		renamingId: string | null;
		/** Whether a branch is open -- see `isExpanded` in `CodePanel`. */
		isExpanded: (id: string) => boolean;
		/** Opens a closed branch, or closes an open one. */
		ontoggle: (id: string) => void;
		/** Handed the pointer event that began a drag on this row's handle. */
		onstartdrag: (id: string, event: PointerEvent) => void;
		/** `null` ends the rename; an id starts one. */
		onrename: (id: string | null) => void;
	} = $props();

	const drag = useCodeDrag();

	const code = $derived(row.original.code);
	const expandable = $derived(row.subRows.length > 0);
	const expanded = $derived(isExpanded(code.id));
	const selected = $derived(tree.selectedId === code.id);
	const mark = $derived(kindMark(code));
	const renaming = $derived(renamingId === code.id);

	/**
	 * Selects the field's whole contents, because a rename almost always
	 * replaces the placeholder name rather than appending to it.
	 */
	function takeCaret(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	const dragging = $derived(drag.id === code.id);
	const over = $derived(drag.overId === code.id ? drag.position : null);
	// Only the nest reading colours the whole row; before and after are lines in
	// a gap and have to say which gap, which a filled row cannot.
	const nesting = $derived(over === 'inside');

	// Stuck under its own ancestors rather than at the top of the pane: one
	// header per level, in the order the reader would read them. Only a row with
	// something open under it earns a seat -- a leaf that stuck would pin a code
	// the rows below it have nothing to do with.
	//
	// Deliberately plain CSS rather than a scroll listener. The `treeitem`
	// wrapper spans the row and its whole branch and is what bounds the sticky
	// row, so a header stops sticking exactly when its last descendant scrolls
	// away and the next branch's header pushes it out -- both for free, and both
	// fiddly to reproduce by measuring.
	const sticky = $derived(expandable && expanded);
</script>

<!-- The nested shape ARIA asks for -- an item that contains the group of its
     children -- which is also the shape sticky headers need: the wrapper is the
     containing block that bounds the one below it. -->
<div
	role="treeitem"
	aria-expanded={expandable ? expanded : undefined}
	aria-selected={selected}
	tabindex={selected ? 0 : -1}
	class="relative outline-none"
	onclick={(event) => {
		// A click lands on every ancestor of the row it hit; without this the
		// selection would travel back up the branch and settle on its root.
		event.stopPropagation();
		tree.selectedId = code.id;
	}}
	ondblclick={(event) => {
		event.stopPropagation();
		onrename(code.id);
	}}
	onkeydown={(event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		tree.selectedId = code.id;
	}}
>
	<div
		data-code-row
		data-code-id={code.id}
		class="group/row grid grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-gray-100 pr-2 text-[0.8125rem]
			{sticky ? 'sticky z-10' : ''}
			{nesting && drag.valid
			? 'bg-emerald-50'
			: nesting
				? 'bg-red-50'
				: selected
					? 'bg-primary/10'
					: 'bg-white hover:bg-gray-50'}
			{dragging ? 'opacity-40' : ''}"
		style:height="{ROW_HEIGHT}px"
		style:top={sticky ? `${row.depth * ROW_HEIGHT}px` : undefined}
		style:z-index={sticky ? 20 - row.depth : undefined}
	>
		<!-- The insertion point, drawn in the gap the drop would use. Absolute so
		     it costs the row no height and cannot shift what the reader is aiming
		     at mid-drag. Indented to where the code would land, which is the only
		     thing that distinguishes dropping after a leaf from dropping after
		     the branch it ends. -->
		{#if over === 'before' || over === 'after'}
			<div
				class="pointer-events-none absolute right-0 left-0 z-20 h-0.5 {drag.valid
					? 'bg-emerald-500'
					: 'bg-red-400'}"
				style:top={over === 'before' ? '-1px' : `${ROW_HEIGHT - 1}px`}
				style:margin-left="{row.depth * 11 + 26}px"
			></div>
		{/if}

		<div class="flex items-center" style:padding-left="{row.depth * 11}px">
			<button
				type="button"
				class="cursor-grab touch-none px-1 text-gray-300 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
				title="Drag to move or reorder"
				aria-label="Move {displayName(code.name)}"
				onpointerdown={(event) => onstartdrag(code.id, event)}
				onclick={(event) => event.stopPropagation()}
			>
				<i class="fa-solid fa-grip-vertical text-[0.625rem]"></i>
			</button>

			{#if expandable}
				<button
					type="button"
					class="flex h-4 w-3.5 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-700"
					aria-label="{expanded ? 'Collapse' : 'Expand'} {displayName(code.name)}"
					onclick={(event) => {
						event.stopPropagation();
						ontoggle(code.id);
					}}
				>
					<i
						class="fa-solid fa-chevron-right text-[0.5625rem] transition-transform {expanded
							? 'rotate-90'
							: ''}"
					></i>
				</button>
			{:else}
				<!-- Holds the column open so names line up down a level regardless of
				     which siblings happen to have children. -->
				<span class="h-4 w-3.5"></span>
			{/if}
		</div>

		<div class="flex min-w-0 items-center gap-1.5">
			<!-- The branch's colour, the same mark the canvas paints down a node's
			     left edge. -->
			<span
				class="h-1.5 w-1.5 shrink-0 rounded-full"
				style:background-color={code.color}
				aria-hidden="true"
			></span>
			{#if renaming}
				<input
					type="text"
					value={code.name}
					class="min-w-0 flex-1 rounded-sm border border-primary bg-white px-1 py-0 text-[0.8125rem] text-gray-900 focus:ring-0"
					oninput={(event) =>
						tree.patch(code.id, { name: event.currentTarget.value }, `name:${code.id}`)}
					onblur={() => {
						tree.endEdit();
						onrename(null);
					}}
					onkeydown={(event) => {
						// Both keys end the edit: every keystroke has already been
						// committed, so there is no draft for Escape to throw away --
						// undo is what takes a rename back, here as on the canvas.
						if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
						event.stopPropagation();
					}}
					onclick={(event) => event.stopPropagation()}
					ondblclick={(event) => event.stopPropagation()}
					{@attach takeCaret}
				/>
			{:else}
				<span
					class="truncate {selected ? 'font-medium text-gray-900' : 'text-gray-700'}"
					title={displayName(code.name)}
				>
					{displayName(code.name)}
				</span>
			{/if}
			{#if !renaming && code.definition.trim() === '' && code.kind !== 'group'}
				<!-- A code nobody has written a rule for is not yet one a second coder
				     could apply. Worth a mark here and not only in the inspector: the
				     table is where a codebook is read as a whole, which is when the
				     gaps are worth seeing. -->
				<i
					class="fa-solid fa-circle-exclamation shrink-0 text-[0.5625rem] text-amber-500"
					title="No definition yet"
				></i>
			{/if}
		</div>

		<span
			class="flex shrink-0 items-center gap-1 text-[0.6875rem] text-gray-400"
			title={mark.title}
		>
			<i class="fas {mark.icon}"></i>
			{#if mark.label}<span class="tabular-nums">{mark.label}</span>{/if}
		</span>
	</div>

	{#if expanded && row.subRows.length > 0}
		<div role="group">
			{#each row.subRows as child (child.id)}
				<Self row={child} {tree} {renamingId} {isExpanded} {ontoggle} {onstartdrag} {onrename} />
			{/each}
		</div>
	{/if}
</div>
