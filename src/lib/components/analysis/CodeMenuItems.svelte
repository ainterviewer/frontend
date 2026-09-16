<script lang="ts">
	import { displayName, scoreRangeLabel, type Code } from '$lib/coding/codingTree';
	import Self from './CodeMenuItems.svelte';

	interface Props {
		/** The codes at this level, each already carrying its own children. */
		items: { code: Code; children: Props['items'] }[];
		/** Code ids the target already carries, drawn with a tick. */
		applied: Set<string>;
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
</script>

<ul class="min-w-52 py-1" role="menu">
	{#each items as item (item.code.id)}
		{@const code = item.code}
		{@const branch = item.children.length > 0}
		{@const scored = code.kind === 'score'}
		{@const folds = branch || scored}
		<li
			class="relative"
			onmouseenter={() => (openId = folds ? code.id : null)}
			onmouseleave={() => (openId = null)}
		>
			<button
				type="button"
				role="menuitem"
				class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
				onclick={() => {
					// A group organises the codebook and is never applied, so its row
					// only ever opens its branch. Everything else applies on click and
					// opens on hover, which keeps a parent code reachable — the usual
					// failure of a cascading menu is that a code with sub-codes can no
					// longer be chosen itself.
					if (code.kind === 'group' || scored) openId = openId === code.id ? null : code.id;
					else onpick(code, null);
				}}
				onfocus={() => (openId = folds ? code.id : null)}
				aria-haspopup={folds ? 'menu' : undefined}
				aria-expanded={folds ? openId === code.id : undefined}
				title={code.definition || undefined}
			>
				<span
					class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] text-white"
					style={applied.has(code.id)
						? `background-color: ${code.color}`
						: `border: 1.5px solid ${code.color}`}
				>
					{#if applied.has(code.id)}<i class="fa-solid fa-check"></i>{/if}
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
				<!-- `-top-1` lines the fold-out's first row up with the row it hangs
				     off, past the list's own padding. No margin between the two: a gap
				     is a strip belonging to neither, and crossing it fires the
				     `mouseleave` that closes the thing the pointer is heading for. -->
				<div
					class="absolute -top-1 z-10 rounded-md border border-gray-200 bg-white shadow-lg {flip
						? 'right-full'
						: 'left-full'}"
				>
					{#if scored}
						<!-- A score is picked *and* valued in one gesture: its fold-out is
						     its own scale, so there is no second step where a code has
						     been chosen but says nothing yet. -->
						<div class="flex items-center gap-1 p-1.5">
							{#each scale(code) as value (value)}
								<button
									type="button"
									role="menuitem"
									class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-xs font-medium text-gray-700 transition-colors"
									onmouseenter={(event) => {
										event.currentTarget.style.backgroundColor = code.color;
										event.currentTarget.style.color = '#fff';
									}}
									onmouseleave={(event) => {
										event.currentTarget.style.backgroundColor = '';
										event.currentTarget.style.color = '';
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
