<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { fly } from 'svelte/transition';

	import { displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';

	import { type CodeRowLike, kindMark, ROW_HEIGHT } from './codeTable';
	import { useCodeDrag } from './codeTableDrag.svelte';
	import Self from './CodeTreeRow.svelte';

	let {
		row,
		tree,
		renamingId,
		isExpanded,
		isFiltering,
		countOf = () => null,
		ontoggle,
		onstartdrag,
		onrename,
		onfilter,
		ondefine,
		onlike
	}: {
		row: CodeRowLike;
		tree: CodingTreeState;
		/** The one code whose name is being typed, if any. */
		renamingId: string | null;
		/** Whether a branch is open -- see `isExpanded` in `CodePanel`. */
		isExpanded: (id: string) => boolean;
		/**
		 * Whether this code's reference is in the keyword box, and so is
		 * narrowing the corpus. Read from the query rather than held beside it:
		 * the box is the filter, and a second copy would have to be kept
		 * agreeing with something the reader can edit by hand.
		 */
		isFiltering: (id: string) => boolean;
		/** How much of what is on screen this code accounts for -- see `CodePanel`. */
		countOf?: (id: string) => { count: number; subtree: number } | null;
		/** Opens a closed branch, or closes an open one. */
		ontoggle: (id: string) => void;
		/** Handed the pointer event that began a drag on this row's handle. */
		onstartdrag: (id: string, event: PointerEvent) => void;
		/** `null` ends the rename; an id starts one. */
		onrename: (id: string | null) => void;
		/** Puts this code's reference into the keyword box, or takes it out. */
		onfilter: (id: string) => void;
		/**
		 * Searches the corpus for what the code *says* it is -- its name and
		 * definition, as a query. Works on a code nothing has been applied to,
		 * which is the half of searching from a code that exists from the start.
		 */
		ondefine?: (id: string) => void;
		/**
		 * Ranks the corpus against what the code has *become* -- the average of
		 * the passages somebody applied it to. Needs coded data to mean
		 * anything, so a code at zero is offered it disabled with the count
		 * saying why.
		 */
		onlike?: (id: string, subtree: boolean) => void;
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
	const filtering = $derived(isFiltering(code.id));
	// A branch filters as a branch: the reference the pane writes for a code
	// with children carries `/*`, so the label should say what the click does.
	/**
	 * The number beside the row, and what it is a number of.
	 *
	 * Two numbers only where they differ, because most rows are leaves and a
	 * pane this narrow cannot spend the width on saying `3 · 3`. A GROUP shows
	 * the branch alone: it is never applied, so its own count is always zero
	 * and `0 · 47` would be noise that means nothing.
	 *
	 * Null where nothing in view carries it -- drawn as nothing rather than as
	 * a zero, so the rows that have something to say are the ones with ink on
	 * them.
	 */
	const counted = $derived(countOf(code.id));
	/**
	 * How many chunks a centroid would be averaged from -- the branch where
	 * this row filters as a branch, so the number matches what the action
	 * actually does.
	 *
	 * It is the badge's count and so is counted over the *filtered* corpus,
	 * not the project. That is the honest number here: the search ranks what
	 * the filters leave, so a code with fifty passages elsewhere and none in
	 * view has nothing in view to be like.
	 */
	const seeded = $derived(expandable ? (counted?.subtree ?? 0) : (counted?.count ?? 0));
	const badge = $derived.by(() => {
		if (!counted) return null;
		const unit = `chunk${counted.subtree === 1 ? '' : 's'} in view`;
		if (code.kind === 'group') {
			return { text: `${counted.subtree}`, title: `${counted.subtree} ${unit} under this branch` };
		}
		if (counted.count === counted.subtree) {
			return { text: `${counted.count}`, title: `${counted.count} ${unit} coded with this` };
		}
		return {
			text: `${counted.count} · ${counted.subtree}`,
			title: `${counted.count} coded with this, ${counted.subtree} counting everything under it`
		};
	});

	const filterLabel = $derived(
		filtering
			? `Stop filtering by ${displayName(code.name)}`
			: expandable
				? `Filter to ${displayName(code.name)} and everything under it`
				: `Filter to ${displayName(code.name)}`
	);
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
					aria-label="Rename {displayName(code.name)}"
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

		<div class="flex shrink-0 items-center gap-1.5">
			<!-- One slot, two uses: what the code is worth at rest, what can be
			     done with it on hover. Stacked in a single grid cell rather than
			     laid out side by side, so the cell is as wide as the wider of the
			     two and never as wide as both -- the buttons used to appear out of
			     nothing and shove the count leftwards on every pass of the mouse.

			     A row that is *filtering* keeps its buttons at rest: a filter
			     narrowing everything on screen has to be visible without hunting
			     for it, and this row is where a reader would look to turn it
			     off. -->
			<span class="grid shrink-0 place-items-end">
				{#if badge}
					<span
						class="col-start-1 row-start-1 text-[0.6875rem] text-gray-400 tabular-nums {filtering
							? 'invisible'
							: 'group-hover/row:invisible'}"
						title={badge.title}
					>
						{badge.text}
					</span>
				{/if}

				<span
					class="col-start-1 row-start-1 flex items-center gap-1 transition-opacity {filtering
						? ''
						: 'pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'}"
				>
					<button
						type="button"
						class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm {filtering
							? 'text-primary'
							: 'text-gray-300 hover:text-gray-700'}"
						aria-pressed={filtering}
						title={filterLabel}
						aria-label={filterLabel}
						onclick={(event) => {
							event.stopPropagation();
							onfilter(code.id);
						}}
					>
						<i class="fa-solid fa-filter text-[0.625rem]"></i>
					</button>

					<!-- The two ways of searching *from* a code, behind one opener.
					     Not buttons of their own: a filter is a state this row is in
					     and earns its place, where these two leave and go somewhere,
					     and three icons on a row of a pane this narrow is a row
					     nobody can read. -->
					{#if ondefine && onlike}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								title="Search from {displayName(code.name)}"
								aria-label="Search from {displayName(code.name)}"
								onclick={(event: MouseEvent) => event.stopPropagation()}
								class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-gray-300 hover:text-gray-700"
							>
								<i class="fa-solid fa-ellipsis text-[0.625rem]"></i>
							</DropdownMenu.Trigger>
							<DropdownMenu.Portal>
								<DropdownMenu.Content
									class="z-2000 min-w-[13rem] rounded-md border border-gray-200 bg-white p-1 shadow-lg outline-none"
									sideOffset={4}
									align="end"
									preventScroll={false}
									forceMount
								>
									{#snippet child({ wrapperProps, props, open })}
										{#if open}
											<div {...wrapperProps}>
												<div {...props} transition:fly={{ duration: 150, y: -5 }}>
													<DropdownMenu.Item
														onSelect={() => ondefine(code.id)}
														class="flex cursor-pointer flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs text-gray-700 outline-none data-highlighted:bg-gray-100"
													>
														<span class="font-medium">Search by definition</span>
														<span class="text-[0.625rem] text-gray-500">
															What this code says it is
														</span>
													</DropdownMenu.Item>
													<DropdownMenu.Item
														disabled={seeded === 0}
														onSelect={() => onlike(code.id, expandable)}
														class="flex cursor-pointer flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs text-gray-700 outline-none data-disabled:cursor-not-allowed data-disabled:text-gray-400 data-highlighted:bg-gray-100"
													>
														<span class="font-medium">Find more like these</span>
														<span class="text-[0.625rem] text-gray-500">
															{#if seeded === 0}
																Nothing carries it yet, so there is nothing to be like
															{:else}
																What the {seeded} passage{seeded === 1 ? '' : 's'} carrying it have in
																common
															{/if}
														</span>
													</DropdownMenu.Item>
												</div>
											</div>
										{/if}
									{/snippet}
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					{/if}
				</span>
			</span>

			<!-- One icon and nothing beside it, so the column is the same width on
			     every row -- see `kindMark`. -->
			<span class="flex shrink-0 items-center text-[0.6875rem] text-gray-400" title={mark.title}>
				<i class="fas {mark.icon}"></i>
			</span>
		</div>
	</div>

	{#if expanded && row.subRows.length > 0}
		<div role="group">
			{#each row.subRows as child (child.id)}
				<Self
					row={child}
					{tree}
					{renamingId}
					{isExpanded}
					{isFiltering}
					{countOf}
					{ontoggle}
					{onstartdrag}
					{onrename}
					{onfilter}
					{ondefine}
					{onlike}
				/>
			{/each}
		</div>
	{/if}
</div>
