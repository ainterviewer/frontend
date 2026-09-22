<script lang="ts">
	import { untrack } from 'svelte';

	import {
		ancestorsOf,
		childrenOf,
		type Code,
		type CodeId,
		displayName,
		isApplicable,
		scoreRangeLabel
	} from '$lib/coding/codingTree';

	import CodeMenuItems from './CodeMenuItems.svelte';

	interface Props {
		codes: readonly Code[];
		/** Where the reader right-clicked, in viewport coordinates. */
		at: { x: number; y: number };
		/** The passage the click landed on, which the menu then travels with. */
		anchor: HTMLElement;
		/**
		 * What this coder has already put on the target: code id to value. Ticks
		 * and marked scale numbers come out of it, and picking one takes the
		 * coding off again — see `applyFromMenu` on the explore page.
		 */
		applied: ReadonlyMap<string, number | null>;
		/** The words the code will land on, quoted at the top so it is not a guess. */
		quote?: string | null;
		onpick: (code: Code, value: number | null) => void;
		onclose: () => void;
	}

	let { codes, at, anchor, applied, quote = null, onpick, onclose }: Props = $props();

	let filter = $state('');
	let menu = $state<HTMLElement | null>(null);

	/** The codebook as a tree, which is what the fold-outs walk. */
	type Item = { code: Code; children: Item[] };
	function branchOf(parentId: CodeId | null): Item[] {
		return childrenOf(codes, parentId).map((code) => ({
			code,
			children: branchOf(code.id)
		}));
	}
	let tree = $derived(branchOf(null));

	/**
	 * Typing flattens the menu.
	 *
	 * A cascade is the fastest way through a codebook you know the shape of and
	 * the slowest through one you do not, so the filter does not narrow the tree
	 * in place -- it replaces it with a flat list of what matched, each code
	 * shown under the path that distinguishes it. Groups are left out: nothing
	 * is ever coded with one.
	 */
	let hits = $derived.by(() => {
		const query = filter.trim().toLowerCase();
		if (!query) return [];
		return codes
			.filter((code) => isApplicable(code) && code.name.toLowerCase().includes(query))
			.map((code) => ({
				code,
				path: ancestorsOf(codes, code.id)
					.reverse()
					.map((ancestor) => displayName(ancestor.name))
					.join(' › ')
			}));
	});

	/** `w-60`, in a number, for the two places that place the menu by hand. */
	const width = 240;

	/**
	 * Kept inside the list: a menu opened near the bottom or the right edge of
	 * it would otherwise run past, and past the list is now cut off -- see the
	 * clip below.
	 *
	 * The menu is pulled up by however much it overhangs rather than shortened
	 * to the room below the cursor, so a right-click low in the list opens the
	 * same full menu as one high in it. Only a codebook taller than the list
	 * itself gets a scroll, and then the menu is as tall as the list.
	 *
	 * That cap would ordinarily clip the fold-outs hanging outside the list --
	 * the one thing this menu is for -- which is why `CodeMenuItems` positions
	 * them `fixed` rather than inside the scrolling box.
	 */
	let placement = $derived.by(() => {
		const margin = 8;
		if (typeof window === 'undefined')
			return { left: at.x, top: at.y, maxHeight: 220, flip: false };
		const box = bounds ?? {
			top: 0,
			left: 0,
			right: window.innerWidth,
			bottom: window.innerHeight
		};
		// Before the menu has been measured, the room it has is the best guess at
		// how much of it there is -- which places it against the bottom, where
		// the correction below then moves it once the real height is known.
		const room = Math.max(120, box.bottom - box.top - margin * 2);
		const maxHeight = Math.min(natural ?? room, room);
		const overflowsRight = at.x + width + margin > box.right;
		const top = Math.max(box.top + margin, Math.min(at.y, box.bottom - maxHeight - margin));
		return {
			left: Math.max(box.left + margin, overflowsRight ? at.x - width : at.x),
			top,
			maxHeight,
			// Fold-outs open leftwards once the menu itself has been pulled left:
			// there was no room on that side for the menu, so there is none for a
			// second column beyond it.
			flip: overflowsRight
		};
	});

	/**
	 * The correction from "where CSS put us" to "where the reader clicked".
	 *
	 * `fixed` is only viewport-relative while no ancestor establishes a
	 * containing block for it -- a `transform`, `filter` or `contain` anywhere
	 * above makes the offsets count from *that* box instead, and the menu lands
	 * a whole dialog away from the cursor. Rather than forbidding those
	 * properties in every host this menu is ever rendered into, it measures
	 * where it actually landed once and shifts by the difference, which is zero
	 * in the ordinary case.
	 */
	let shift = $state({ x: 0, y: 0 });

	$effect(() => {
		const node = menu;
		if (!node) return;
		const want = placement;
		// Wherever the scroll has carried the menu to by now: the correction is
		// about an offset ancestor, and must not undo the travel below.
		const carried = drift;
		const box = node.getBoundingClientRect();
		const dx = want.left + carried.x - box.left;
		const dy = want.top + carried.y - box.top;
		// Sub-pixel differences are the browser's rounding, not an offset
		// ancestor, and chasing them would be a loop.
		if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
		const applied = untrack(() => shift);
		shift = { x: applied.x + dx, y: applied.y + dy };
	});

	/**
	 * Scrolling moves the menu with the passage, not with the window.
	 *
	 * `at` is a viewport coordinate and the menu is `fixed`, so left alone it
	 * would hold its place on the screen while the list carried the turn it is
	 * about away underneath -- a menu of codes hanging over some other reader's
	 * words. So the anchor is measured as the menu opens and again on every
	 * scroll, and the menu is offset by however far it has travelled: it keeps
	 * the place it opened in on the *page*, and scrolling far enough takes it
	 * off screen with the passage, which is the honest answer to a reader who
	 * has scrolled away from what they were coding.
	 *
	 * Measuring the anchor rather than the scroller means an unrelated pane --
	 * the rail, the code panel -- moves the menu by exactly zero, without
	 * anything here having to work out which box the turn lives in.
	 */
	let origin = $state<{ x: number; y: number } | null>(null);
	let drift = $state({ x: 0, y: 0 });

	/**
	 * The box the passage scrolls inside, which is the box the menu is kept in.
	 *
	 * Travelling with the passage means travelling out of the list with it, and
	 * a `fixed` menu has no parent to be cut off by -- so it sailed on over the
	 * toolbar and the page heading, which belong to neither the list nor the
	 * menu. The scroll box is found once from the anchor and the menu is
	 * clipped to it below, so it slides under the list's edges the way it would
	 * if it were drawn inside them.
	 *
	 * Only `auto` and `scroll` count. `hidden` clips too, but it is what rounds
	 * the corners off half the cards on this page, and clipping a menu to the
	 * bubble it was opened on would leave nothing of it.
	 */
	function scrollBoxOf(node: HTMLElement): HTMLElement | null {
		for (let el = node.parentElement; el; el = el.parentElement) {
			const style = getComputedStyle(el);
			if (/auto|scroll/.test(style.overflowY) || /auto|scroll/.test(style.overflowX)) return el;
		}
		return null;
	}

	type Box = { top: number; right: number; bottom: number; left: number };

	/**
	 * Re-measured on every scroll, but only *replaced* where it has moved.
	 *
	 * `getBoundingClientRect` hands back a fresh object each time, and taking it
	 * as new state each time made `placement` -- and so the correction above --
	 * run on every scroll event, which put the menu back where it opened on the
	 * screen and undid the travel entirely.
	 */
	function boxOf(el: HTMLElement | null): Box | null {
		if (!el) return null;
		const { top, right, bottom, left } = el.getBoundingClientRect();
		return { top, right, bottom, left };
	}

	function same(a: Box | null, b: Box | null): boolean {
		if (!a || !b) return a === b;
		return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
	}

	let bounds = $state<Box | null>(null);
	let height = $state(0);

	/**
	 * The height the menu would like to be, which is what lets it be placed
	 * rather than merely capped.
	 *
	 * `scrollHeight` reports the content whatever the cap currently is, so this
	 * is the whole codebook's height even on the first pass, when the cap is
	 * still the fallback guess. Taken as the menu opens and not again: the
	 * filter shortens the list with every keystroke, and a menu that re-placed
	 * itself on each one would walk out from under the pointer. `+ 2` is the
	 * border, which `scrollHeight` leaves out.
	 */
	let natural = $state<number | null>(null);

	$effect(() => {
		const box = anchor.getBoundingClientRect();
		origin = { x: box.left, y: box.top };
		drift = { x: 0, y: 0 };
		bounds = boxOf(scrollBoxOf(anchor));
		natural = menu ? menu.scrollHeight + 2 : null;
	});

	function onscrollcapture() {
		// A turn dropped from the list on its way past takes its coordinates with
		// it: `getBoundingClientRect` on a detached node is all zeroes, which
		// would fling the menu into the corner. Better to leave it where it is.
		if (!origin || !anchor.isConnected) return;
		const box = anchor.getBoundingClientRect();
		drift = { x: box.left - origin.x, y: box.top - origin.y };
		// Re-measured because the scroll that moved the passage may have been an
		// outer one that moved the list itself.
		const next = boxOf(scrollBoxOf(anchor));
		if (!same(bounds, next)) bounds = next;
	}

	/**
	 * How much of the menu the scroll box cuts off, as a `clip-path` inset.
	 *
	 * Worked out from where the menu is asked to be rather than from measuring
	 * it, so it is in step with the same scroll that moved it -- and `clip-path`
	 * takes the pointer with it, so a row scrolled under the list's top edge
	 * cannot be hovered or clicked either.
	 */
	let clip = $derived.by(() => {
		if (!bounds) return null;
		const top = placement.top + shift.y + drift.y;
		const left = placement.left + shift.x + drift.x;
		const above = Math.max(0, bounds.top - top);
		const below = Math.max(0, top + height - bounds.bottom);
		const before = Math.max(0, bounds.left - left);
		const beyond = Math.max(0, left + width - bounds.right);
		if (!above && !below && !before && !beyond) return null;
		return `inset(${above}px ${beyond}px ${below}px ${before}px)`;
	});

	/**
	 * Escape closes the menu and nothing else.
	 *
	 * On the window and in the *capture* phase, which is the only place early
	 * enough: this menu is often drawn inside a dialog, and a dialog listens for
	 * Escape on the document. Handling it on the way down and stopping it there
	 * means the key peels off one layer at a time -- the menu now, the dialog
	 * behind it on the next press -- instead of taking both at once.
	 */
	function onescape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		event.preventDefault();
		onclose();
	}

	/**
	 * The filter takes the focus as the menu opens.
	 *
	 * Focused here rather than with `autofocus`, which the browser honours only
	 * once per document: opening the menu a second time -- or opening it inside
	 * a dialog, which has already spent the page's one attempt on itself -- left
	 * the field unfocused, and typing went to whatever had the focus before.
	 */
	let field = $state<HTMLInputElement | null>(null);
	$effect(() => {
		field?.focus();
	});

	function onkeydown(event: KeyboardEvent) {
		// Enter takes the first match, which is what makes the filter a way
		// *through* the menu rather than a way to look at a shorter one.
		if (event.key === 'Enter' && hits.length > 0) {
			event.preventDefault();
			const first = hits[0].code;
			if (first.kind !== 'score') onpick(first, null);
		}
	}

	/**
	 * Closing on anything that is not this menu.
	 *
	 * `pointerdown` rather than `click`, so the menu is gone before whatever was
	 * underneath it reacts, and captured on the window so a click inside another
	 * stopPropagation-ing widget still closes it.
	 */
	function onpointerdown(event: PointerEvent) {
		if (menu && !menu.contains(event.target as Node)) onclose();
	}
</script>

<svelte:window {onpointerdown} {onscrollcapture} onkeydowncapture={onescape} />

<div
	bind:this={menu}
	bind:clientHeight={height}
	role="menu"
	tabindex="-1"
	{onkeydown}
	class="fixed z-50 w-60 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl"
	style="left: {placement.left + shift.x + drift.x}px; top: {placement.top +
		shift.y +
		drift.y}px; max-height: {placement.maxHeight}px{clip ? `; clip-path: ${clip}` : ''}"
>
	{#if quote}
		<p class="truncate border-b border-gray-100 px-3 pb-1.5 text-[11px] text-gray-400">
			<i class="fa-solid fa-quote-left mr-1 text-[8px]"></i>{quote}
		</p>
	{/if}

	<div class="px-2 py-1.5">
		<input
			bind:this={field}
			bind:value={filter}
			placeholder="Filter codes"
			class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-gray-400 focus:outline-none"
		/>
	</div>

	{#if codes.length === 0}
		<p class="px-3 py-3 text-xs text-gray-500">
			No codebook yet. Build one on the Codebook page first.
		</p>
	{:else if filter.trim()}
		{#if hits.length === 0}
			<p class="px-3 py-3 text-xs text-gray-400">No code matches “{filter}”.</p>
		{:else}
			<ul class="py-1" role="menu">
				{#each hits as hit (hit.code.id)}
					<li>
						{#if hit.code.kind === 'score'}
							<!-- A score still needs its number, so the flattened row carries
							     its scale instead of being a single click. -->
							<div class="px-3 py-1.5">
								<div class="mb-1 flex items-center gap-2">
									<span
										class="h-2.5 w-2.5 shrink-0 rounded-full"
										style="background-color: {hit.code.color}"
									></span>
									<span class="min-w-0 flex-1 truncate text-sm text-gray-800">
										{displayName(hit.code.name)}
									</span>
									<span class="text-[10px] text-gray-400">{scoreRangeLabel(hit.code)}</span>
								</div>
								<div class="flex flex-wrap items-center gap-1 pl-4.5">
									{#each { length: (hit.code.maxValue ?? 5) - (hit.code.minValue ?? 1) + 1 } as _, index (index)}
										{@const value = (hit.code.minValue ?? 1) + index}
										{@const held = applied.get(hit.code.id) === value}
										<!-- The same marked number the cascade's scale draws. -->
										<button
											type="button"
											role="menuitem"
											aria-pressed={held}
											class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-xs transition-colors {held
												? 'text-white'
												: 'bg-gray-50 text-gray-700 hover:bg-gray-200'}"
											style={held ? `background-color: ${hit.code.color}` : ''}
											onclick={() => onpick(hit.code, value)}
										>
											{value}
										</button>
									{/each}
								</div>
								{#if hit.path}
									<p class="truncate pl-4.5 text-[10px] text-gray-400">{hit.path}</p>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								role="menuitem"
								class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
								onclick={() => onpick(hit.code, null)}
							>
								<!-- The same two marks the cascade draws; see `CodeMenuItems`. -->
								<span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
									{#if applied.has(hit.code.id)}
										<span
											class="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] text-white"
											style="background-color: {hit.code.color}"
										>
											<i class="fa-solid fa-check"></i>
										</span>
									{:else}
										<span class="h-2 w-2 rounded-full" style="background-color: {hit.code.color}"
										></span>
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm text-gray-800">
										{displayName(hit.code.name)}
									</span>
									{#if hit.path}
										<span class="block truncate text-[10px] text-gray-400">{hit.path}</span>
									{/if}
								</span>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<CodeMenuItems items={tree} {applied} flip={placement.flip} {onpick} />
	{/if}
</div>
