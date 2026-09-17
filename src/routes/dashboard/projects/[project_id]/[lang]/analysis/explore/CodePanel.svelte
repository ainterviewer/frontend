<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { dropPosition, resolveDrop } from '$lib/coding/codeDrop';
	import { displayName, type Code } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';
	import SaveState from '$lib/coding/SaveState.svelte';
	import type { Codebook } from '$lib/coding/store.svelte';
	import { createColumnHelper, createTable, tableFeatures } from '@tanstack/svelte-table';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { ROW_HEIGHT, toCodeRows, type CodeRow, type CodeRowLike } from './codeTable';
	import { CodeDrag, provideCodeDrag } from './codeTableDrag.svelte';
	import { codeTermFor, isFiltering as termIsFiltering, toggleCodeTerm } from './codeFilter';
	import {
		coverageLabel,
		defaultCoverage,
		joinApplies,
		type Coded,
		type CoverageAxes
	} from './explore';
	import CodeNotes from './CodeNotes.svelte';
	import CodeTreeRow from './CodeTreeRow.svelte';

	let {
		tree,
		book = null,
		open = $bindable(true),
		keyword = $bindable(''),
		coverage = $bindable(defaultCoverage()),
		countOf = () => null,
		ondefine,
		onlike
	}: {
		tree: CodingTreeState;
		book?: Codebook | null;
		open?: boolean;
		/**
		 * The keyword box, which is where a code filter actually lives.
		 *
		 * Bound rather than held here: a reference the pane writes and one the
		 * reader types are the same thing, and the box is already what the URL
		 * carries and what the requests are built from. A separate "selected
		 * codes" state would be a second answer to one question.
		 */
		keyword?: string;
		/**
		 * Which coverage question the corpus is narrowed by.
		 *
		 * Beside the codes rather than in the control rail because it is a
		 * question about *them*: "what have I not read yet" is asked while
		 * looking at the codebook, not while setting up a corpus.
		 */
		coverage?: CoverageAxes;
		/**
		 * How much of what is on screen each code accounts for, or null where
		 * nothing in view carries it.
		 *
		 * A function rather than a map so the pane can be rendered against a
		 * codebook with no corpus behind it -- the codebook page, and every
		 * test of this component -- without inventing numbers for it.
		 */
		countOf?: (id: string) => { count: number; subtree: number } | null;
		/**
		 * Searching the corpus for what a code says it is, and for what it has
		 * become. Handed up rather than done here: both replace what the list
		 * is showing, which is the page's business and not the pane's.
		 *
		 * Optional, and the menu is absent without them rather than inert: the
		 * pane is also drawn against a codebook with no corpus behind it -- the
		 * tests, and anywhere the codebook is edited rather than read -- and an
		 * action that goes nowhere is worse than one that is not offered.
		 */
		ondefine?: (code: Code) => void;
		onlike?: (code: Code, subtree: boolean) => void;
	} = $props();

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

	/**
	 * The reference each row would write, by id.
	 *
	 * Built once per codebook edit rather than per row, because working out
	 * whether a name needs qualifying reads the whole codebook -- doing that
	 * inside every row would be quadratic in a pane that redraws on each
	 * keystroke of a rename.
	 */
	const terms = $derived(
		new Map(tree.codes.map((code) => [code.id, codeTermFor(code, tree.codes)]))
	);

	const isFiltering = $derived.by(() => {
		const query = keyword;
		const written = terms;
		return (id: string) => {
			const term = written.get(id);
			return term !== undefined && termIsFiltering(query, term);
		};
	});

	/**
	 * The coverage states, in the order they narrow.
	 *
	 * "Uncoded" last because it is the one asked for deliberately: it is a
	 * working pass rather than a reading of the corpus, and it is the only one
	 * that can empty a view a reader was in the middle of.
	 */
	/**
	 * One row per axis, because the three do not factor into fewer.
	 *
	 * "Mine" and "others" are a grid, and between them say everything a
	 * conjunction can -- the review pass, the agreement set, what only I have
	 * read. What a grid cannot say is "somebody has coded this", which is
	 * mine-*or*-theirs; that is the third axis, and it is a plain toggle
	 * because its other state ("nobody has") is already the grid's
	 * uncoded/uncoded corner.
	 */
	/**
	 * The operator, which is what makes the two rows a complete 2x2.
	 *
	 * `and` names the four quadrants -- coded by both, only me, to review, read
	 * by nobody. `or` names their complements, and two of those are questions a
	 * conjunction cannot ask at all: "somebody has coded this" is coded-or-coded,
	 * and "not coded by both" is uncoded-or-uncoded, which is the work left in a
	 * double-coding pass.
	 */
	const JOIN: { value: 'and' | 'or'; label: string; hint: string }[] = [
		{
			value: 'and',
			label: 'AND',
			hint: 'Both rows must hold — the four quadrants: coded by both, only you, to review, read by nobody.'
		},
		{
			value: 'or',
			label: 'OR',
			hint: 'Either row is enough — the complements: “coded by anyone” is Coded or Coded, “not coded by both” is Uncoded or Uncoded.'
		}
	];

	const AXIS: { value: Coded | null; label: string }[] = [
		{ value: null, label: 'Any' },
		{ value: 'any', label: 'Coded' },
		{ value: 'none', label: 'Uncoded' }
	];

	// What the three rows add up to, where that has a name. Most combinations
	// have none and need none -- the rows say what they are -- but "mine:
	// uncoded, others: coded" is the second-coder pass and says so to nobody.
	const named = $derived(coverageLabel(coverage));

	/**
	 * Whether the operator is deciding anything.
	 *
	 * Dimmed where it is not, which is honest rather than decorative: `or` over
	 * one condition is that condition, so until both rows are set it is a
	 * control that changes no answer.
	 */
	const joining = $derived(joinApplies(coverage));

	/** A row reports an id; the page wants the code. */
	function byId(id: string, then: (code: Code) => void) {
		const code = tree.codes.find((one) => one.id === id);
		if (code) then(code);
	}

	function filterBy(id: string) {
		const term = terms.get(id);
		if (term === undefined) return;

		const next = toggleCodeTerm(keyword, term);
		if (next === null) {
			// Only reachable on a query this pane did not write. Saying so beats
			// rewriting an expression the reader built by hand.
			toast.info('Take this code out of the keyword box by hand');
			return;
		}
		keyword = next;
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
	const codebookHref = $derived.by(() => {
		const project_id = page.params.project_id;
		// Null outside a router rather than a link to nowhere. `resolve` throws
		// on a missing parameter, and the pane is rendered without one in every
		// test of it -- so a link built unconditionally is a link that takes the
		// whole pane down with it wherever it is not on a project's page.
		if (!project_id) return null;
		return resolve('/dashboard/projects/[project_id]/[lang]/analysis/codebook', {
			project_id,
			lang: page.params.lang ?? 'en'
		});
	});

	const drag = new CodeDrag();
	provideCodeDrag(drag);

	let renamingId = $state<string | null>(null);
	let scroller = $state<HTMLElement | null>(null);
	let panel = $state<HTMLElement | null>(null);

	/**
	 * Letting go of a selected row.
	 *
	 * A selection here is a target -- it decides what *+ Sub-code* nests under
	 * and what the delete button removes -- so being unable to clear it leaves
	 * the reader aiming at something they have finished with. Escape and a
	 * click away are the two gestures everything else on the page already
	 * answers to.
	 *
	 * Deliberately not on blur: the panel loses focus every time the reader
	 * types in the keyword box, and a selection that evaporated on the way to
	 * the search field would be one nobody could use.
	 */
	function deselect() {
		tree.selectedId = null;
	}

	/**
	 * Whether an editor currently holds the caret.
	 *
	 * The notes below the tree are typed into, and both ways of letting go of a
	 * row would otherwise close them mid-sentence: Escape while writing a memo,
	 * and clicking into a transcript to check the passage you are writing
	 * *about*. Escape leaves the field first and clears the row on a second
	 * press, which is the ordinary two-step everywhere else.
	 */
	function editing(): boolean {
		const active = document.activeElement;
		return (
			active instanceof HTMLElement &&
			(active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') &&
			panel?.contains(active) === true
		);
	}

	//: How tall the notes pane opens, and the ends it can be dragged between.
	//: Tall enough for a definition at a glance, short enough that the tree is
	//: still a tree.
	const NOTES_DEFAULT = 200;
	const NOTES_MIN = 96;
	//: Never past the point where the tree is a single row -- a split that can
	//: be dragged shut is a split with a way to lose the list behind it.
	const NOTES_MAX_FRACTION = 0.7;
	const NOTES_KEY = 'explore.codeNotesHeight';

	/**
	 * The split, remembered across visits.
	 *
	 * Read at init rather than in an effect: the page is client-only
	 * (`ssr = false`), so storage is there on the first render and a height
	 * applied afterwards would be a visible jump on every load.
	 */
	let notesHeight = $state(
		untrack(() => {
			try {
				const stored = Number(localStorage.getItem(NOTES_KEY));
				return Number.isFinite(stored) && stored >= NOTES_MIN ? stored : NOTES_DEFAULT;
			} catch {
				// Private mode, or storage the browser refuses. A default is a
				// perfectly good answer and not worth failing a render over.
				return NOTES_DEFAULT;
			}
		})
	);

	let splitting = $state(false);

	function startResize(event: PointerEvent) {
		event.preventDefault();
		splitting = true;

		function onMove(move: PointerEvent) {
			const box = panel?.getBoundingClientRect();
			if (!box) return;
			// Measured from the bottom of the pane, which is the edge the notes
			// are anchored to -- dragging up makes them taller.
			const wanted = box.bottom - move.clientY;
			notesHeight = Math.max(NOTES_MIN, Math.min(wanted, box.height * NOTES_MAX_FRACTION));
		}

		function onUp() {
			splitting = false;
			window.removeEventListener('pointermove', onMove);
			try {
				localStorage.setItem(NOTES_KEY, String(Math.round(notesHeight)));
			} catch {
				// See above: the split simply does not survive the visit.
			}
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, { once: true });
		window.addEventListener('pointercancel', onUp, { once: true });
	}

	const selected = $derived(tree.codes.find((code) => code.id === tree.selectedId) ?? null);

	$effect(() => {
		function onKey(event: KeyboardEvent) {
			// Only when there is something to let go of, so this never competes
			// with an Escape the reader meant for a menu or a modal.
			if (event.key !== 'Escape' || tree.selectedId === null) return;
			// A field takes the first Escape for itself, so a reader leaves what
			// they were typing before they let go of the row it belongs to.
			if (editing()) {
				(document.activeElement as HTMLElement).blur();
				return;
			}
			deselect();
		}

		function onPointerDown(event: PointerEvent) {
			if (tree.selectedId === null) return;
			// Mid-sentence in the notes: clicking a transcript to check the
			// passage being written about must not close what is being written.
			if (editing()) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			// Inside the pane is not "away": its toolbar acts *on* the selection
			// -- *+ Sub-code* nests under it -- so clearing before the button's
			// own handler ran would take the target out from under it. A click
			// on the empty space below the rows is handled where that space is.
			if (panel?.contains(target)) return;
			// The row menu is portalled to the body, so it is outside the pane
			// by construction while plainly being part of it.
			if (target instanceof Element && target.closest('[role="menu"]')) return;
			deselect();
		}

		window.addEventListener('keydown', onKey);
		window.addEventListener('pointerdown', onPointerDown);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pointerdown', onPointerDown);
		};
	});

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

<!-- One axis, as a labelled row of exclusive states. Written once because the
     two grid rows are the same control twice, and a row that drifted from its
     twin would read as a difference in meaning. -->
{#snippet axisRow(label: string, value: Coded | null, set: (next: Coded | null) => void)}
	<div class="flex items-center gap-1.5">
		<span
			id="axis-{label}"
			class="w-12 shrink-0 text-[0.625rem] font-medium tracking-wide text-gray-400 uppercase"
			>{label}</span
		>
		<div
			role="group"
			aria-labelledby="axis-{label}"
			class="flex overflow-hidden rounded-md border border-gray-200"
		>
			{#each AXIS as option (option.label)}
				<button
					type="button"
					onclick={() => set(option.value)}
					aria-pressed={value === option.value}
					class="cursor-pointer px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap transition-colors {value ===
					option.value
						? 'bg-primary text-on-primary'
						: 'bg-white text-gray-500 hover:text-gray-900'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

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
	<div
		bind:this={panel}
		class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
	>
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

		<!-- How a code gets onto a passage, said once and where the codes are: the
		     gesture is a right-click on a turn, which is not a thing a reader
		     discovers by looking at a transcript. -->
		<p
			class="shrink-0 border-b border-gray-100 bg-gray-50/60 px-2.5 py-1.5 text-[0.625rem] leading-relaxed text-gray-500"
		>
			<i class="fa-solid fa-circle-info mr-1 text-gray-400"></i>
			Right-click a turn to apply a code to it. Select part of it first to code just that passage.
		</p>

		<!-- Coverage, which is a different question from which codes a chunk
		     carries: this one asks whether it carries any. A segmented control
		     rather than two toggles, because the three states are exclusive and
		     "Either" has to be reachable in one click from both. -->
		<!-- Coverage: who has coded what, which is a different question from
		     which codes a chunk carries. One row per axis -- see `AXIS`. -->
		<div
			role="group"
			aria-label="Coverage"
			class="flex shrink-0 flex-col gap-1 border-b border-gray-200 px-1.5 py-1.5"
		>
			{@render axisRow('Mine', coverage.mine, (next) => (coverage = { ...coverage, mine: next }))}

			<!-- The operator, in the gutter between the two rows it joins and under
			     the *Coded* segment of them: it is the column both rows have to
			     be on for it to decide anything, so standing it there says what
			     it joins without a word.
			     
			     Centred across *Coded* and *Uncoded* together rather than over
			     one of them: those are the two states that make a row
			     participate, and the operator is what happens when both rows are
			     on one of them.

			     Aligned by mirroring rather than by a measured offset. The spans
			     below are the real segments' own labels, drawn invisible, so
			     they are exactly as wide as the things they stand under and stay
			     that way when a label or a padding changes. The mirror has to be
			     the wider of the two things in the grid cell, or `place-items-
			     center` centres *it* inside the cell the operator sized and the
			     alignment slips by half their difference. `ml-px` is the
			     segmented control's own left border, which the mirror sits
			     inside of. -->
			<div class="flex items-center gap-1.5">
				<span class="w-12 shrink-0"></span>
				<span class="ml-px flex shrink-0 items-center">
					<!-- The mirrors: the real segments' own labels, drawn invisible,
					     so they are exactly as wide as the things they stand under
					     and stay that way when a label or a padding changes.
					     `aria-hidden` on these and never on the wrapper -- it takes
					     a whole subtree out of the accessibility tree, and the
					     control is in there. -->
					{#each AXIS.slice(0, 2) as option (option.label)}
						<span aria-hidden="true" class="invisible px-1.5 py-0.5 text-[0.6875rem] font-medium">
							{option.label}
						</span>
					{/each}
					<!-- Which leaves us exactly on the line between *Coded* and
					     *Uncoded*, and the operator's own divider lands on it: AND
					     under Coded, OR under Uncoded, one vertical line down all
					     three rows.

					     Its *centre* is not that line -- AND is a wider word than
					     OR -- so the two buttons are anchored to the seam from
					     either side rather than the pair being centred on it. That
					     is also what keeps them out of flow: they are positioned
					     *by* the mirrors and must not be able to push them around.
					     -->
					<span class="relative self-stretch">
						<div role="group" aria-label="Join" class={joining ? '' : 'opacity-40'}>
							{#each JOIN as option, index (option.value)}
								<button
									type="button"
									onclick={() => (coverage = { ...coverage, join: option.value })}
									aria-pressed={coverage.join === option.value}
									title={option.hint}
									class="absolute top-1/2 -translate-y-1/2 cursor-pointer border border-gray-200 px-1 py-0.5 text-[0.5625rem] font-semibold tracking-wide transition-colors
										{index === 0 ? 'right-0 rounded-l-md border-r-0' : 'left-0 rounded-r-md'}
										{coverage.join === option.value
										? 'bg-primary text-on-primary'
										: 'bg-white text-gray-500 hover:text-gray-900'}"
								>
									{option.label}
								</button>
							{/each}
						</div>
					</span>
					<!-- The rest of the row, so the line above has something to be
					     the middle of and the operator has room to sit over. -->
					<span aria-hidden="true" class="invisible px-1.5 py-0.5 text-[0.6875rem] font-medium">
						{AXIS[2].label}
					</span>
				</span>
				{#if !joining}
					<span class="text-[0.625rem] text-gray-400">Set both rows to join them</span>
				{/if}
			</div>

			{@render axisRow(
				'Others',
				coverage.others,
				(next) => (coverage = { ...coverage, others: next })
			)}

			{#if named}
				<p class="pl-[3.375rem] text-[0.625rem] leading-relaxed text-gray-500">
					<span class="font-medium text-gray-700">{named.label}</span> — {named.hint}
				</p>
			{/if}
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
			onclickcapture={(event) => {
				// The empty space under the last row. `currentTarget` rather than
				// `contains`, so a click that landed on a row and stopped there
				// is not read as a click on the space around it.
				if (event.target === event.currentTarget) deselect();
			}}
			role="tree"
			aria-label="Codebook"
			aria-multiselectable="false"
			class="min-h-0 flex-1 overflow-y-auto {drag.active ? 'select-none' : ''}"
		>
			{#if rootRows.length === 0}
				<p class="px-4 py-8 text-center text-sm text-gray-500">
					This project has no codes yet. Add one here{#if codebookHref}, or flesh it out in the
						<a
							href={codebookHref}
							class="font-medium text-primary underline-offset-2 hover:underline">codebook</a
						>{/if}.
				</p>
			{:else}
				{#each rootRows as row (row.id)}
					<CodeTreeRow
						{row}
						{tree}
						{renamingId}
						{isExpanded}
						{isFiltering}
						{countOf}
						ontoggle={toggle}
						ondefine={ondefine && ((id) => byId(id, ondefine))}
						onlike={onlike && ((id, subtree) => byId(id, (code) => onlike(code, subtree)))}
						onstartdrag={startDrag}
						onrename={(id) => (renamingId = id)}
						onfilter={filterBy}
					/>
				{/each}
			{/if}
		</div>

		{#if selected}
			<!-- The two fields written while *reading* rather than while planning.
			     Below the tree because it is about one row of it, and resizable
			     because a definition is a sentence and a memo grows all session.
			     -->
			<div
				role="separator"
				aria-label="Resize notes"
				aria-orientation="horizontal"
				tabindex="-1"
				onpointerdown={startResize}
				class="group/split flex h-2 shrink-0 cursor-row-resize items-center justify-center border-t border-gray-200 bg-gray-50 hover:bg-gray-100 {splitting
					? 'bg-gray-100'
					: ''}"
			>
				<span class="h-0.5 w-6 rounded-full bg-gray-300 group-hover/split:bg-gray-400"></span>
			</div>
			<div
				class="flex shrink-0 flex-col overflow-hidden {splitting ? 'select-none' : ''}"
				style:height="{notesHeight}px"
			>
				<CodeNotes {tree} code={selected} onclose={deselect} />
			</div>
		{/if}

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
