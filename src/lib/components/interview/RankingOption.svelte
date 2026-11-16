<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { untrack } from 'svelte';

	/**
	 * One option of a ranking: dragged by its handle, or moved a place at a
	 * time with its buttons, which is also how it moves from the keyboard and
	 * where dragging is awkward.
	 */
	let {
		id,
		index,
		group,
		text,
		rank,
		count,
		locked,
		moveUp,
		moveDown,
		onmove
	}: {
		id: string;
		index: number;
		/** The ranking it belongs to, so two rankings on a page stay apart. */
		group: string;
		text: string;
		/** Its rank, from 1, or null when it falls outside the top N. */
		rank: number | null;
		/** How many options there are. */
		count: number;
		locked: boolean;
		moveUp: string;
		moveDown: string;
		onmove: (from: number, to: number) => void;
	} = $props();

	const { ref, handleRef, isDragging } = useSortable(
		untrack(() => ({
			id,
			index: () => index,
			group,
			type: group,
			accept: group,
			disabled: () => locked
		}))
	);
</script>

<li
	{@attach ref}
	class="flex items-center gap-2 rounded-xl border-l-4 bg-white py-1.5 pr-1.5 pl-1 shadow-sm transition-colors {rank !=
	null
		? 'border-primary'
		: 'border-transparent'} {isDragging.current ? 'opacity-60 shadow-md' : ''}"
>
	<span
		{@attach handleRef}
		class="flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded text-gray-400 {locked
			? 'invisible'
			: 'cursor-grab hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing'}"
		aria-hidden="true"
	>
		<i class="fa-solid fa-grip-vertical"></i>
	</span>
	<span
		class="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums {rank !=
		null
			? 'bg-primary text-white'
			: 'bg-gray-100 text-gray-400'}"
	>
		{rank ?? '–'}
	</span>
	<span class="min-w-0 flex-1 text-sm leading-snug font-medium break-words text-gray-800"
		>{text}</span
	>
	{#if !locked}
		<span class="flex shrink-0 flex-col">
			<button
				type="button"
				class="flex h-5 w-7 items-center justify-center rounded text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:ring-2 focus:ring-primary focus:outline-none disabled:invisible"
				disabled={index === 0}
				onclick={() => onmove(index, index - 1)}
				title={moveUp}
				aria-label="{moveUp}: {text}"
			>
				<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				class="flex h-5 w-7 items-center justify-center rounded text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:ring-2 focus:ring-primary focus:outline-none disabled:invisible"
				disabled={index === count - 1}
				onclick={() => onmove(index, index + 1)}
				title={moveDown}
				aria-label="{moveDown}: {text}"
			>
				<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
			</button>
		</span>
	{/if}
</li>
