<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { dropPosition, resolveDrop } from '$lib/coding/codeDrop';
	import { displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';
	import SaveState from '$lib/coding/SaveState.svelte';
	import type { Codebook } from '$lib/coding/store.svelte';
	import { createColumnHelper, createTable, tableFeatures } from '@tanstack/svelte-table';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { ROW_HEIGHT, toCodeRows, type CodeRow, type CodeRowLike } from './codeTable';
	import { CodeDrag, provideCodeDrag } from './codeTableDrag.svelte';
	import CodeTreeRow from './CodeTreeRow.svelte';

	let {
		tree,
		book = null,
		open = $bindable(true)
	}: { tree: CodingTreeState; book?: Codebook | null; open?: boolean } = $props();

	/**
	 * The table registers no features at all.
	 *
	 * Sorting a codebook would be meaningless -- sibling order *is* the analyst's
	 * ordering, and the drag handles are how it is changed -- and a filter that
	 * hid a parent would hide branches whose children matched. What is wanted
	 * from TanStack here is the tree walk and the column definitions.
	 *
	 * `rowExpandingFeature` is deliberately not among them. It keeps the open
	 * branches in its own state atom and hands that atom's value to
	 * `onExpandedChange`, which is *not* the rune this component reads -- so a
	 * toggle came back carrying a state the pane had never seen, and every other
	 * branch in the tree closed. Expansion is three lines of bookkeeping; owning
	 * it outright is cheaper than keeping two copies of it agreeing.
	 */
	const codeTreeFeatures = tableFeatures({});

	const helper = createColumnHelper<typeof codeTreeFeatures, CodeRow>();

	const columns = helper.columns([
		helper.accessor((row) => row.code.name, { id: 'name', header: 'Code' }),
		helper.accessor((row) => row.code.kind, { id: 'kind', header: 'Kind' })
	]);

	let rows = $derived(toCodeRows(tree.codes));

	const table = createTable({
		features: codeTreeFeatures,
		columns,
		get data() {
			return rows;
		},
		getRowId: (row) => row.code.id,
		getSubRows: (row) => row.children
	});

	const rootRows = $derived(table.getCoreRowModel().rows as unknown as CodeRowLike[]);

	// Opened on the top-level branches, and not by an effect: effects do not run
	// during the first render, so the pane would paint a flat list and unfold it
	// afterwards -- and would then re-open branches the reader had closed, every
	// time an edit changed the codebook. A codebook's shape is its branches; a
	// tree that opens fully buries them under leaves, and one that opens flat has
	// not said anything yet.
	let openIds = $state<Record<string, boolean>>(
		untrack(() =>
			Object.fromEntries(
				tree.codes.filter((code) => code.parentId === null).map((code) => [code.id, true])
			)
		)
	);

	/**
	 * Keyed by code id rather than by position, so the open branches survive
	 * every edit that rewrites the list -- which is all of them, and a drag most
	 * of all.
	 */
	const isExpanded = $derived.by(() => {
		const open = openIds;
		return (id: string) => open[id] === true;
	});

	function toggle(id: string) {
		openIds = { ...openIds, [id]: !openIds[id] };
	}

	/** Every code with something under it: the rows an expand-all is about. */
	const expandableIds = $derived([
		...new Set(tree.codes.map((code) => code.parentId).filter((id): id is string => id !== null))
	]);

	const allExpanded = $derived(
		expandableIds.length > 0 && expandableIds.every((id) => openIds[id])
	);

	function toggleAll() {
		openIds = allExpanded ? {} : Object.fromEntries(expandableIds.map((id) => [id, true]));
	}

	// The codebook page is the same project's, one route over. Derived rather
	// than computed up front: the empty state is the only thing that reads it,
	// and the pane is also rendered in tests, outside a router.
	const codebookHref = $derived(
		resolve('/dashboard/projects/[project_id]/[lang]/analysis/coding', {
			project_id: page.params.project_id ?? '',
			lang: page.params.lang ?? 'en'
		})
	);

	const drag = new CodeDrag();
	provideCodeDrag(drag);

	let renamingId = $state<string | null>(null);
	let scroller = $state<HTMLElement | null>(null);

	/**
	 * Rows are rendered nested rather than from the expanded row model, which is
	 * flat. The nesting is what makes the sticky ancestors work without a scroll
	 * listener -- see `CodeTreeRow` -- and TanStack is still what decides which
	 * rows exist and which are open.
	 */

	function startDrag(id: string, event: PointerEvent) {
		// Otherwise the browser starts its own text selection drag, and the row
		// under the pointer is never the one `elementFromPoint` reports.
		event.preventDefault();
		drag.start(id);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp, { once: true });
		window.addEventListener('pointercancel', onPointerUp, { once: true });
	}

	/** The row under the pointer, and what dropping there would mean. */
	function proposalAt(clientX: number, clientY: number) {
		const dragged = drag.id;
		if (dragged === null) return null;
		const element = document
			.elementFromPoint(clientX, clientY)
			?.closest<HTMLElement>('[data-code-row]');
		const targetId = element?.dataset.codeId;
		if (!element || !targetId) return null;

		const rect = element.getBoundingClientRect();
		const fraction = (clientY - rect.top) / rect.height;
		// A row that cannot take the branch as a child has no middle: reading the
		// centre of it as a nest would light the row red for a gesture the reader
		// never made, when what they are over is plainly a gap.
		const position = dropPosition(fraction, tree.canMoveTo(dragged, targetId));
		return { targetId, position, spot: resolveDrop(tree.codes, dragged, targetId, position) };
	}

	function onPointerMove(event: PointerEvent) {
		// Dragging to a code that is off the bottom of a pane this short is the
		// common case, not the exotic one, so the edges pull.
		if (scroller) {
			const rect = scroller.getBoundingClientRect();
			const margin = ROW_HEIGHT;
			if (event.clientY < rect.top + margin) scroller.scrollBy({ top: -ROW_HEIGHT });
			else if (event.clientY > rect.bottom - margin) scroller.scrollBy({ top: ROW_HEIGHT });
		}

		const proposal = proposalAt(event.clientX, event.clientY);
		if (!proposal) {
			drag.over(null, 'inside', false);
			return;
		}
		drag.over(proposal.targetId, proposal.position, proposal.spot !== null);
	}

	function onPointerUp(event: PointerEvent) {
		window.removeEventListener('pointermove', onPointerMove);
		const dragged = drag.id;
		// Resolved again from the release point rather than trusting what the last
		// move said: a drop is where the reader let go, and the two part company
		// whenever the pointer leaves the pane between the two events.
		const proposal = dragged === null ? null : proposalAt(event.clientX, event.clientY);
		drag.end();
		if (dragged === null || !proposal?.spot) return;
		tree.moveTo(dragged, proposal.spot.parentId, proposal.spot.index);
	}

	function addCode() {
		// Under whatever is selected, which is what the reader is looking at;
		// nothing selected means a new branch of its own.
		const parentId = tree.selectedId;
		const id = parentId === null ? tree.addRootCode() : tree.addChild(parentId);
		// A code added under a collapsed parent would otherwise be created, named
		// `New sub-code`, and immediately invisible.
		if (parentId !== null) openIds = { ...openIds, [parentId]: true };
		renamingId = id;
	}

	function removeSelected() {
		const id = tree.selectedId;
		if (!id) return;
		const removed = tree.remove(id);
		if (!removed) return;
		// The same bargain the canvas strikes: deleting a branch takes everything
		// under it, and an undo in the toast is cheaper than a confirmation on
		// every delete.
		toast.success(
			removed.removed === 1
				? `Deleted “${displayName(removed.name)}”`
				: `Deleted “${displayName(removed.name)}” and ${removed.removed - 1} sub-code${removed.removed === 2 ? '' : 's'}`,
			{ action: { label: 'Undo', onClick: () => tree.undo() } }
		);
	}
</script>

{#if !open}
	<!-- Minimised the way the control rail is, and self-contained: the strip
	     carries its own way back, so a pane that is out of the way never needs
	     the page to grow a button for it. -->
	<div
		class="flex h-full w-9 shrink-0 flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white py-2"
	>
		<button
			type="button"
			onclick={() => (open = true)}
			aria-label="Show codes"
			class="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
		>
			<i class="fas fa-angles-left text-[0.6875rem]"></i>
		</button>
		<span
			class="text-[0.6875rem] font-semibold tracking-wide text-gray-500 uppercase [writing-mode:vertical-rl]"
		>
			Codes
		</span>
		<span class="text-[0.6875rem] text-gray-400 tabular-nums [writing-mode:vertical-rl]">
			{tree.codes.length}
		</span>
	</div>
{:else}
	<div class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
		<!-- The control rail's header, mirrored rather than copied: it is the other
		     pane of the same page, so title and chevron sit at the same two
		     extremes, swapped. The chevron takes the inner edge because that is
		     where this pane's way out points -- leftwards, into the page. -->
		<div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-2 py-2">
			<button
				type="button"
				onclick={() => (open = false)}
				aria-label="Hide codes"
				class="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
			>
				<i class="fas fa-angles-right text-[0.6875rem]"></i>
			</button>
			<h2 class="text-[0.6875rem] font-semibold tracking-wide text-gray-500 uppercase">Codes</h2>
		</div>

		<div class="flex shrink-0 items-center gap-0.5 border-b border-gray-200 px-1.5 py-1">
			<button
				type="button"
				class="cursor-pointer rounded-md px-1.5 py-1 text-[0.6875rem] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
				onclick={toggleAll}
			>
				<i
					class="fa-solid {allExpanded
						? 'fa-angles-up'
						: 'fa-angles-down'} mr-1 text-[0.625rem] text-gray-400"
				></i>
				{allExpanded ? 'Collapse all' : 'Expand all'}
			</button>

			<div class="ml-auto flex items-center gap-1">
				<button
					type="button"
					class="cursor-pointer rounded-md px-1.5 py-1 text-[0.6875rem] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
					onclick={addCode}
				>
					<i class="fa-solid fa-plus mr-1 text-[0.625rem] text-gray-400"></i>
					{tree.selectedId ? 'Sub-code' : 'Code'}
				</button>
				<button
					type="button"
					class="cursor-pointer rounded-md px-1.5 py-1 text-[0.6875rem] font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
					disabled={!tree.selectedId}
					aria-label="Delete selected code"
					onclick={removeSelected}
				>
					<i class="fa-solid fa-trash-can text-[0.625rem]"></i>
				</button>
			</div>
		</div>

		<!-- The header row, from the column definitions rather than written out, so
	     adding a column cannot leave the table saying one thing and its headings
	     another. -->
		{#each table.getHeaderGroups() as group (group.id)}
			<div
				class="grid shrink-0 grid-cols-[1fr_auto] gap-1 border-b border-gray-200 bg-gray-50 py-0.5 pr-2 pl-8 text-[0.625rem] font-medium tracking-wide text-gray-400 uppercase"
			>
				{#each group.headers as header (header.id)}
					<span class={header.column.id === 'kind' ? 'text-right' : ''}>
						{header.column.columnDef.header}
					</span>
				{/each}
			</div>
		{/each}

		<div
			bind:this={scroller}
			role="tree"
			aria-label="Codebook"
			aria-multiselectable="false"
			class="min-h-0 flex-1 overflow-y-auto {drag.active ? 'select-none' : ''}"
		>
			{#if rootRows.length === 0}
				<p class="px-4 py-8 text-center text-sm text-gray-500">
					This project has no codes yet. Add one here, or flesh it out in the <a
						href={codebookHref}
						class="font-medium text-primary underline-offset-2 hover:underline">codebook</a
					>.
				</p>
			{:else}
				{#each rootRows as row (row.id)}
					<CodeTreeRow
						{row}
						{tree}
						{renamingId}
						{isExpanded}
						ontoggle={toggle}
						onstartdrag={startDrag}
						onrename={(id) => (renamingId = id)}
					/>
				{/each}
			{/if}
		</div>

		<div
			class="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-3 py-1 text-[0.625rem] text-gray-400"
		>
			<span>
				{tree.codes.length} code{tree.codes.length === 1 ? '' : 's'} · drag to move, double-click to rename
			</span>
			<!-- The pane edits the project's real codebook, so it says where the
			     edits went. Optional because the pane is also rendered in tests
			     against a tree with nothing behind it. -->
			{#if book}<SaveState {book} />{/if}
		</div>
	</div>
{/if}
