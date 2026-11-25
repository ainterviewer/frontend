<script lang="ts">
	import { move } from '@dnd-kit/helpers';
	import {
		DragDropProvider,
		type DragEndEvent,
		type DragOverEvent,
		KeyboardSensor,
		PointerSensor
	} from '@dnd-kit-svelte/svelte';
	import { untrack } from 'svelte';

	import { getUiText } from '$lib/respondentText';
	import { encodeRankingAnswer, initialOrder, moveTo, rankedCount } from '$lib/survey/ranking';

	import RankingOption from './RankingOption.svelte';

	/**
	 * A ranking: the options put in order of preference, answered as one.
	 *
	 * Every option is in the list, and the respondent drags them into order
	 * (or moves them a place at a time with the arrows). With a top N, the
	 * first N are the ranking and the rest sit under a "not ranked" line.
	 * The answer is a JSON array of the ranked options' texts, first choice
	 * first (`encodeRankingAnswer`) -- the library's `RankingItem.encode_answer`.
	 */
	let {
		options,
		optionOrder = null,
		topN = null,
		answer = '',
		readonly = false,
		preview = false,
		lang = 'EN',
		phone = false,
		onAnswer
	}: {
		/** As authored: the answer names options from this list. */
		options: string[];
		/**
		 * The order this interview starts the options in, as positions in
		 * `options`: drawn when the interview started, where the item shuffles.
		 */
		optionOrder?: number[] | null;
		topN?: number | null;
		/** The submitted answer, shown read-only. */
		answer?: string;
		readonly?: boolean;
		/** Interactive but never submitted: the guide editor's live preview. */
		preview?: boolean;
		lang?: string;
		/** Lay out as on a phone whatever the screen: the editor's phone preview. */
		phone?: boolean;
		onAnswer?: (answer: string) => boolean | void;
	} = $props();

	let t = $derived(getUiText(lang).ranking);

	let count = $derived(rankedCount(options, topN));
	let ranksAll = $derived(count === options.length);

	// Positions in `options`, in the order shown. Seeded once: a submitted
	// answer's ranking first, else the order the interview drew.
	let order = $state<number[]>(
		untrack(() => initialOrder(options, optionOrder, readonly ? answer : undefined))
	);
	let submitted = $state(false);
	let locked = $derived(readonly || submitted);

	const uid = $props.id();
	const group = `ranking-${uid}`;
	const sensors = [KeyboardSensor, PointerSensor];

	// The order is moved as the dragged option passes over the others, as the
	// guide editor's questions are, so the option it displaces steps aside
	// and every rank shown is the one a drop there would give. A cancelled
	// drag (Escape) puts the order back as it was.
	let before: number[] | null = null;

	function onDragStart() {
		before = order;
	}

	function onDragOver(event: DragOverEvent) {
		if (locked) return;
		order = move(order.map(String), event).map(Number);
	}

	function onDragEnd(event: DragEndEvent) {
		if (event.canceled && before) order = before;
		before = null;
	}

	function onmove(from: number, to: number) {
		if (locked) return;
		order = moveTo(order, from, to);
	}

	function submit() {
		if (locked) return;
		// `false`: not sent (the connection is down), so leave it open.
		if (onAnswer?.(encodeRankingAnswer(options, order, count)) === false) return;
		submitted = true;
	}
</script>

<div class="w-full max-w-full min-w-60">
	<fieldset
		class="rounded-2xl border border-gray-100 bg-gray-200 p-3 {phone ? '' : 'sm:p-4'} {readonly
			? 'pointer-events-none'
			: ''}"
	>
		<legend
			class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
		>
			{ranksAll ? t.legend : t.legendTop(count)}
		</legend>

		<DragDropProvider {sensors} {onDragStart} {onDragOver} {onDragEnd}>
			<ol class="flex flex-col gap-1.5">
				{#each order as position, index (position)}
					{#if index === count && !ranksAll}
						<li
							class="flex items-center gap-2 px-1 pt-1 text-[0.6875rem] font-medium tracking-wide text-gray-500 uppercase"
							aria-hidden="true"
						>
							<span class="h-px flex-1 bg-gray-300"></span>
							{t.notRanked}
							<span class="h-px flex-1 bg-gray-300"></span>
						</li>
					{/if}
					<RankingOption
						id={String(position)}
						{index}
						{group}
						text={options[position]}
						rank={index < count ? index + 1 : null}
						count={order.length}
						{locked}
						moveUp={t.moveUp}
						moveDown={t.moveDown}
						{onmove}
					/>
				{/each}
			</ol>
		</DragDropProvider>
	</fieldset>

	{#if !locked && !preview}
		<div class="mt-2 flex justify-end">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all hover:scale-110 hover:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-98"
				onclick={submit}
				aria-label={t.submit}
				title={t.submit}
			>
				<i class="fa-solid fa-arrow-right rtl:-scale-x-100"></i>
			</button>
		</div>
	{/if}
</div>
