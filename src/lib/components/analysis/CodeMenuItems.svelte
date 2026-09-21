<script lang="ts">
	import { type Code, displayName, scoreRangeLabel } from '$lib/coding/codingTree';

	import Self from './CodeMenuItems.svelte';

	interface Props {
		/** The codes at this level, each already carrying its own children. */
		items: { code: Code; children: Props['items'] }[];
		/**
		 * What this coder has already put on the target: code id to value, the
		 * value being the number a score holds and `null` for everything else.
		 * Ticked rows and marked scale numbers both come out of it, and picking
		 * one of them takes the coding off again.
		 */
		applied: ReadonlyMap<string, number | null>;
		/** Open the submenu to the left, where the right edge is out of room. */
		flip: boolean;
		onpick: (code: Code, value: number | null) => void;
	}

	let { items, applied, flip, onpick }: Props = $props();

	/**
	 * Which item's fold-out is showing.
	 *
	 * One at a time and held here rather than in each item, so opening a sibling
	 * closes the one before it — a menu with two branches hanging off it is two
	 * menus, and the reader has no way to tell which one their next click
	 * belongs to.
	 */
	let openId = $state<string | null>(null);

	function scale(code: Code): number[] {
		const min = code.minValue ?? 1;
		const max = code.maxValue ?? 5;
		return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
	}

	/**
	 * The fold-out is placed by hand, in viewport coordinates.
	 *
	 * It has to be `fixed`: the list it hangs off scrolls, and an absolutely
	 * positioned fold-out would be clipped by that scroll box -- a cascade you
	 * cannot see past the first column is not a cascade. Being out of flow, it
	 * also has nothing to keep it on screen, so the position below both keeps it
	 * beside its row and pulls it up and caps its height when the row sits near
	 * the bottom of the window.
	 */
	let fold = $state<HTMLElement | null>(null);
	let pos = $state<{ left: number; top: number; maxHeight: number } | null>(null);

	/**
	 * A fold-out belongs to the row it opened from, so the measurements taken
	 * for the last row are dropped as the next one takes over -- otherwise the
	 * new fold-out is drawn for one frame at the old row's place.
	 */
	function show(id: string | null) {
		if (id === openId) return;
		openId = id;
		pos = null;
	}

	$effect(() => {
		const node = fold;
		if (!node) return;
		// Read so the pass repeats after each correction until it settles: the
		// first pass measures the fold-out where CSS happened to put it, the next
		// one confirms it landed where we asked.
		const placed = pos;
		// `fixed` counts from the viewport only while no ancestor establishes a
		// containing block for it; a `transform` or `filter` on any host above
		// makes it count from *that* box instead. Rather than measuring the
		// offset, we place, measure where it actually landed, and correct -- the
		// correction is zero in the ordinary case. See the same dance in
		// `CodeMenu`.
		const row = node.parentElement;
		if (!row) return;
		const anchor = row.getBoundingClientRect();
		const box = node.getBoundingClientRect();
		const margin = 8;
		// `- 4` lines the fold-out's first row up with the row it hangs off, past
		// the list's own padding.
		const wantLeft = flip
			? Math.max(margin, anchor.left - box.width)
			: Math.min(anchor.right, window.innerWidth - box.width - margin);
		const wantTop = Math.max(
			margin,
			Math.min(anchor.top - 4, window.innerHeight - box.height - margin)
		);
		const maxHeight = window.innerHeight - wantTop - margin;
		const dx = wantLeft - box.left;
		const dy = wantTop - box.top;
		// Sub-pixel differences are the browser's rounding, and chasing them
		// would be a loop.
		if (placed && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && placed.maxHeight === maxHeight)
			return;
		pos = { left: (placed?.left ?? 0) + dx, top: (placed?.top ?? 0) + dy, maxHeight };
	});

	/**
	 * Scrolling the list a fold-out hangs off closes it.
	 *
	 * The fold-out is placed once, against where its row was; scrolling that row
	 * out from under it would leave it pointing at nothing. Captured on the
	 * window because `scroll` does not bubble, and ignored when the scroll is
	 * the fold-out's own -- reading a long branch must not dismiss it.
	 */
	function onscrollcapture(event: Event) {
		if (!fold || openId === null) return;
		const target = event.target as Node;
		if (fold === target || fold.contains(target)) return;
		show(null);
	}
</script>

<svelte:window {onscrollcapture} />

<ul class="min-w-52 py-1" role="menu">
	{#each items as item (item.code.id)}
		{@const code = item.code}
		{@const branch = item.children.length > 0}
		{@const scored = code.kind === 'score'}
		{@const folds = branch || scored}
		<li
			class="relative"
			onmouseenter={() => show(folds ? code.id : null)}
			onmouseleave={() => show(null)}
		>
			<!-- A group's row opens its branch and codes nothing, so it keeps the
			     plain arrow: a pointer promises an action that picking it does not
			     perform. -->
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none {code.kind ===
				'group'
					? 'cursor-default'
					: 'cursor-pointer'}"
				onclick={() => {
					// A group organises the codebook and is never applied, so its row
					// only ever opens its branch. Everything else applies on click and
					// opens on hover, which keeps a parent code reachable — the usual
					// failure of a cascading menu is that a code with sub-codes can no
					// longer be chosen itself.
					if (code.kind === 'group' || scored) show(openId === code.id ? null : code.id);
					else onpick(code, null);
				}}
				onfocus={() => show(folds ? code.id : null)}
				aria-haspopup={folds ? 'menu' : undefined}
				aria-expanded={folds ? openId === code.id : undefined}
				title={code.definition || undefined}
			>
				<!-- A fixed slot holding one of two marks. Unapplied, the code is a
				     small filled dot, the size the code pane and the canvas draw it
				     at — it says which code this is without competing with the name
				     beside it. Applied, it grows into a ticked disc, because that is
				     the exceptional state and the one worth noticing. -->
				<span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
					{#if applied.has(code.id)}
						<span
							class="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] text-white"
							style="background-color: {code.color}"
						>
							<i class="fa-solid fa-check"></i>
						</span>
					{:else}
						<span class="h-2 w-2 rounded-full" style="background-color: {code.color}"></span>
					{/if}
				</span>
				<span
					class="min-w-0 flex-1 truncate {code.kind === 'group'
						? 'text-gray-500'
						: 'text-gray-800'}"
				>
					{displayName(code.name)}
				</span>
				{#if scored}
					<span class="shrink-0 text-[10px] text-gray-400">{scoreRangeLabel(code)}</span>
				{/if}
				{#if folds}
					<i class="fa-solid fa-chevron-right shrink-0 text-[8px] text-gray-400"></i>
				{/if}
			</button>

			{#if folds && openId === code.id}
				<!-- Flush against the row it hangs off: a gap is a strip belonging to
				     neither, and crossing it fires the `mouseleave` that closes the
				     thing the pointer is heading for. Still a DOM child of the row
				     despite being `fixed`, which is what keeps that hover pairing
				     working. Hidden until it has been measured and placed, so it is
				     never seen in the corner it is first laid out in. -->
				<div
					bind:this={fold}
					class="fixed z-50 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg {pos
						? ''
						: 'invisible'}"
					style={pos
						? `left: ${pos.left}px; top: ${pos.top}px; max-height: ${pos.maxHeight}px`
						: 'left: 0; top: 0'}
				>
					{#if scored}
						<!-- A score is picked *and* valued in one gesture: its fold-out is
						     its own scale, so there is no second step where a code has
						     been chosen but says nothing yet. -->
						<div class="flex items-center gap-1 p-1.5">
							{#each scale(code) as value (value)}
								<!-- The number the score already holds stays filled, the way
								     hovering fills one: it is the same statement — this is what
								     the passage would say — and it is what makes a second click
								     on it legible as taking the score off. -->
								{@const held = applied.get(code.id) === value}
								<button
									type="button"
									role="menuitem"
									aria-pressed={held}
									class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-xs font-medium text-gray-700 transition-colors"
									style={held ? `background-color: ${code.color}; color: #fff` : ''}
									onmouseenter={(event) => {
										event.currentTarget.style.backgroundColor = code.color;
										event.currentTarget.style.color = '#fff';
									}}
									onmouseleave={(event) => {
										event.currentTarget.style.backgroundColor = held ? code.color : '';
										event.currentTarget.style.color = held ? '#fff' : '';
									}}
									onclick={() => onpick(code, value)}
								>
									{value}
								</button>
							{/each}
						</div>
					{/if}
					{#if branch}
						<!-- A score can have sub-codes too, and its scale must not be the
						     reason they become unreachable. -->
						{#if scored}<div class="border-t border-gray-100"></div>{/if}
						<Self items={item.children} {applied} {flip} {onpick} />
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>
