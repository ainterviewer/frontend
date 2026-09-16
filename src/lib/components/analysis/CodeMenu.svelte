<script lang="ts">
	import {
		ancestorsOf,
		childrenOf,
		displayName,
		isApplicable,
		scoreRangeLabel,
		type Code,
		type CodeId
	} from '$lib/coding/codingTree';
	import CodeMenuItems from './CodeMenuItems.svelte';

	interface Props {
		codes: readonly Code[];
		/** Where the reader right-clicked, in viewport coordinates. */
		at: { x: number; y: number };
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

	let { codes, at, applied, quote = null, onpick, onclose }: Props = $props();

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

	/**
	 * Kept on screen: a menu opened near the bottom or the right edge would
	 * otherwise run off it, and a context menu has no scroll of its own to get
	 * the reader back to.
	 *
	 * The cascade deliberately does not scroll -- a scrolling container clips
	 * the fold-outs that hang outside it, which is the one thing this menu is
	 * for. Only the flat filtered list scrolls, and it has nothing hanging off
	 * it to clip.
	 */
	let placement = $derived.by(() => {
		const width = 240;
		const height = 320;
		const margin = 8;
		if (typeof window === 'undefined') return { left: at.x, top: at.y, flip: false };
		const overflowsRight = at.x + width + margin > window.innerWidth;
		return {
			left: overflowsRight ? Math.max(margin, at.x - width) : at.x,
			top: Math.max(margin, Math.min(at.y, window.innerHeight - height - margin)),
			// Fold-outs open leftwards once the menu itself has been pulled left:
			// there was no room on that side for the menu, so there is none for a
			// second column beyond it.
			flip: overflowsRight
		};
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			onclose();
			return;
		}
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

<svelte:window {onpointerdown} onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div
	bind:this={menu}
	role="menu"
	tabindex="-1"
	{onkeydown}
	class="fixed z-50 w-60 rounded-md border border-gray-200 bg-white py-1 shadow-xl {filter.trim()
		? 'max-h-80 overflow-y-auto'
		: 'overflow-visible'}"
	style="left: {placement.left}px; top: {placement.top}px"
>
	{#if quote}
		<p class="truncate border-b border-gray-100 px-3 pb-1.5 text-[11px] text-gray-400">
			<i class="fa-solid fa-quote-left mr-1 text-[8px]"></i>{quote}
		</p>
	{/if}

	<div class="px-2 py-1.5">
		<!-- svelte-ignore a11y_autofocus -->
		<input
			autofocus
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
