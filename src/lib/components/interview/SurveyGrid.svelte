<script lang="ts">
	import { untrack } from 'svelte';

	import type { GridRow } from '$lib/api';
	import { getUiText } from '$lib/respondentText';
	import { encodeGridAnswer, parseGridAnswer } from '$lib/survey/grid';
	import {
		givesWay,
		gridCardMinWidth,
		gridStatementShare,
		gridTableMinWidth,
		likertLayout
	} from '$lib/survey/likert';

	/**
	 * A Likert grid: several statements rated on one scale, answered as one.
	 *
	 * The answer is a JSON object from row id to the chosen option
	 * (`encodeGridAnswer`), a row left blank absent from it -- the library's
	 * `LikertGridItem.encode_answer`.
	 *
	 * A table, columns for the scale as on paper, where its headings fit with
	 * every word whole; elsewhere, and always on a phone, each row is a card
	 * of its own. A card has the scale's points side by side where their words
	 * fit across it, a long one hyphenated, and stacked as rows, like a single
	 * Likert item's, where they do not. See `givesWay`: decided from the text, so the server
	 * renders the layout the browser keeps.
	 */
	let {
		rows,
		options,
		answer = '',
		readonly = false,
		preview = false,
		lang = 'EN',
		phone = false,
		onAnswer
	}: {
		rows: GridRow[];
		options: string[];
		/** The submitted answer, shown read-only. */
		answer?: string;
		readonly?: boolean;
		/** Interactive but never submitted: the guide editor's live preview. */
		preview?: boolean;
		lang?: string;
		/** Lay out as on a phone whatever the screen: the editor's phone preview. */
		phone?: boolean;
		onAnswer?: (answer: string) => void;
	} = $props();

	let t = $derived(getUiText(lang).grid);

	let tableGivesWay = $derived(givesWay(gridTableMinWidth(options), true, phone));
	const TABLE = {
		never: { table: '', cards: 'hidden' },
		sm: { table: 'hidden sm:block', cards: 'sm:hidden' },
		md: { table: 'hidden md:block', cards: 'md:hidden' },
		always: { table: 'hidden', cards: '' }
	} as const;
	let layout = $derived(TABLE[tableGivesWay]);

	// A numbered scale, or one worded on a few points only, puts its words
	// under the card's points as anchors, as a single Likert item does
	// (`likertLayout`); each point then shows only its number, if any.
	let scale = $derived(likertLayout(options));
	let cardStack = $derived(givesWay(gridCardMinWidth(options), false, phone));
	const CARD_COLUMN =
		'flex-1 basis-0 flex-col items-center gap-1.5 px-0.5 py-2 text-center text-[0.6875rem] leading-tight';
	const CARD_STACK = {
		never: { list: 'flex', option: CARD_COLUMN, column: '', row: 'hidden', anchors: '' },
		sm: {
			list: 'flex max-sm:flex-col max-sm:gap-0.5 max-sm:pt-1.5',
			option: `${CARD_COLUMN} max-sm:flex-none max-sm:flex-row max-sm:gap-3 max-sm:py-1.5 max-sm:border max-sm:border-gray-200 max-sm:px-3 max-sm:text-left max-sm:text-sm`,
			column: 'max-sm:hidden',
			row: 'hidden max-sm:inline',
			anchors: 'max-sm:hidden'
		},
		md: {
			list: 'flex max-md:flex-col max-md:gap-0.5 max-md:pt-1.5',
			option: `${CARD_COLUMN} max-md:flex-none max-md:flex-row max-md:gap-3 max-md:py-1.5 max-md:border max-md:border-gray-200 max-md:px-3 max-md:text-left max-md:text-sm`,
			column: 'max-md:hidden',
			row: 'hidden max-md:inline',
			anchors: 'max-md:hidden'
		},
		always: {
			list: 'flex flex-col gap-0.5 pt-1.5',
			option:
				'flex-none flex-row items-center gap-3 border border-gray-200 px-3 py-1.5 text-left text-sm',
			column: 'hidden',
			row: '',
			anchors: 'hidden'
		}
	} as const;
	let card = $derived(CARD_STACK[cardStack]);

	// Chosen option per row id, seeded once from a submitted answer.
	let chosen = $state<Record<string, string>>(
		untrack(() => (readonly && answer ? parseGridAnswer(answer, rows) : {}))
	);
	let submitted = $state(false);
	let locked = $derived(readonly || submitted);

	// Every required row rated, and at least one row in all: a grid of
	// optional rows still needs something to send.
	let complete = $derived(
		rows.every((row) => row.required === false || chosen[row.id ?? '']) &&
			Object.keys(chosen).length > 0
	);

	const uid = $props.id();

	function choose(row: GridRow, option: string) {
		if (locked || !row.id) return;
		chosen[row.id] = option;
	}

	// A row the respondent may leave blank can be emptied again: by clicking
	// its chosen option a second time, as a radio cannot do on its own, or
	// with the clear button beside it. The click arrives before any change,
	// so a row still holding `option` here was already set to it.
	function toggle(row: GridRow, option: string) {
		if (locked || !row.id || row.required !== false) return;
		if (chosen[row.id] === option) clear(row);
	}

	function clear(row: GridRow) {
		if (locked || !row.id) return;
		delete chosen[row.id];
	}

	function submit() {
		if (locked || !complete) return;
		submitted = true;
		onAnswer?.(encodeGridAnswer(chosen, rows));
	}
</script>

<!-- A break allowed after a slash ("Hverken/eller"); see `labelWords`. -->
{#snippet label(text: string)}{#each text.split('/') as part, k (k)}{#if k > 0}/<wbr
			/>{/if}{part}{/each}{/snippet}

{#snippet clearButton(row: GridRow)}
	<button
		type="button"
		class="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
		onclick={() => clear(row)}
		title={t.clear}
		aria-label="{t.clear}: {row.text}"
	>
		<i class="fa-solid fa-xmark" aria-hidden="true"></i>
	</button>
{/snippet}

<!-- `lang` so the scale's headings hyphenate by the respondent's language,
     and only a word of seven letters or more ("bli-ver" reads badly). -->
<div class="w-full max-w-full min-w-60 [hyphenate-limit-chars:7_3_3]" lang={lang.toLowerCase()}>
	<fieldset
		class="rounded-2xl border border-gray-100 bg-gray-200 p-3 {phone ? '' : 'sm:p-4'} {locked
			? 'pointer-events-none'
			: ''}"
	>
		<legend
			class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
		>
			{t.rateEach}
		</legend>

		<!-- Wide: one table, the scale across the top. -->
		<div class="overflow-x-auto {layout.table}">
			<!-- Fixed layout: the statement column gets its share (`gridStatementShare`) and the scale
			     points split the rest evenly, so a short label is never squeezed
			     into a hyphenated sliver and the columns line up under their
			     headings. The white is on the cells, not the row: a table row
			     cannot take rounded corners. -->
			<table class="w-full table-fixed border-separate border-spacing-y-1.5 text-sm">
				<colgroup>
					<col style:width="{gridStatementShare(options) * 100}%" />
					{#each options as _, o (o)}
						<col />
					{/each}
				</colgroup>
				<thead>
					<tr>
						<th scope="col"><span class="sr-only">{t.rateEach}</span></th>
						{#each options as option, o (o)}
							<th
								scope="col"
								class="px-1 pb-1 text-center align-bottom text-xs leading-tight font-medium break-words hyphens-auto text-gray-600 [hyphenate-limit-chars:10_5_4]"
							>
								{@render label(option)}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row, r (row.id ?? r)}
						{@const answered = !!chosen[row.id ?? '']}
						<tr class="group">
							<th
								scope="row"
								class="rounded-l-xl border-l-4 py-3 pr-2 pl-3 text-left leading-snug font-medium break-words [hyphens:manual] text-gray-800 transition-colors {answered
									? 'border-primary bg-white'
									: 'border-transparent bg-white group-hover:bg-gray-50'}"
							>
								{row.text}
								{#if row.required !== false}
									<span class="text-red-500" title={t.required} aria-label={t.required}>*</span>
								{:else if answered && !locked}
									{@render clearButton(row)}
								{/if}
							</th>
							{#each options as option, o (o)}
								<td
									class="p-0 text-center transition-colors last:rounded-r-xl {answered
										? 'bg-white'
										: 'bg-white group-hover:bg-gray-50'}"
								>
									<!-- The whole cell is the target, not just the 16px circle. -->
									<label class="flex h-full min-h-11 cursor-pointer items-center justify-center">
										<input
											type="radio"
											name="grid-{uid}-{r}"
											value={option}
											checked={chosen[row.id ?? ''] === option}
											onclick={() => toggle(row, option)}
											onchange={() => choose(row, option)}
											disabled={submitted && !readonly}
											aria-label="{row.text}: {option}"
											class="h-[1.125rem] w-[1.125rem] cursor-pointer border-gray-400 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
										/>
									</label>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Narrow: the statement goes above its scale instead of beside it --
		     the label column is what does not fit -- and the scale is the
		     single Likert item's own row of radios, each point named under its
		     circle, so a grid on a phone reads like the Likert questions around
		     it. -->
		<div class="flex flex-col gap-2 {layout.cards}">
			{#each rows as row, r (row.id ?? r)}
				{@const answered = !!chosen[row.id ?? '']}
				<div
					class="rounded-xl border-l-4 bg-white px-2 pt-2.5 pb-1 transition-colors {answered
						? 'border-primary'
						: 'border-transparent'}"
					role="radiogroup"
					aria-label={row.text}
				>
					<p class="px-1 text-sm leading-snug font-medium text-gray-800">
						{row.text}
						{#if row.required !== false}
							<span class="text-red-500" title={t.required} aria-label={t.required}>*</span>
						{:else if answered && !locked}
							{@render clearButton(row)}
						{/if}
					</p>
					<div class="w-full items-stretch {card.list}">
						{#each options as option, o (o)}
							<label
								class="flex cursor-pointer rounded-lg font-medium break-words hyphens-auto text-gray-600 transition-colors [hyphenate-limit-chars:7_3_3] hover:bg-gray-100 {card.option}"
							>
								<input
									type="radio"
									id="grid-m-{uid}-{r}-{o}"
									name="grid-m-{uid}-{r}"
									value={option}
									checked={chosen[row.id ?? ''] === option}
									onclick={() => toggle(row, option)}
									onchange={() => choose(row, option)}
									disabled={submitted && !readonly}
									class="h-[1.125rem] w-[1.125rem] shrink-0 border-gray-400 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
								/>
								{#if scale.ticks[o] === option}
									<span class="max-w-full">{@render label(option)}</span>
								{:else}
									<span class="max-w-full {card.column}">{scale.ticks[o]}</span>
									<span class="max-w-full {card.row}">{@render label(option)}</span>
								{/if}
							</label>
						{/each}
					</div>
					{#if scale.anchors.length > 0}
						<!-- As the single Likert item's: hidden from screen readers,
						     since each radio is named in full, but still a click
						     target, and a tick from each point to its words. -->
						<div
							class="-mt-1 grid pb-1.5 text-[0.6875rem] leading-tight font-medium break-words [hyphens:manual] text-gray-600 {card.anchors}"
							style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))"
							aria-hidden="true"
						>
							{#each scale.anchors as anchor (anchor.index)}
								<span
									class="h-1.5 w-px justify-self-center bg-gray-400"
									style:grid-row="1"
									style:grid-column={anchor.index + 1}
								></span>
								<label
									for="grid-m-{uid}-{r}-{anchor.index}"
									class="mt-0.5 min-w-min cursor-pointer text-balance {anchor.align === 'left'
										? 'max-w-[6em] justify-self-start text-left'
										: anchor.align === 'right'
											? 'max-w-[6em] justify-self-end text-right'
											: 'max-w-[8em] justify-self-center text-center'}"
									style:grid-row="2"
									style:grid-column="{anchor.from + 1} / {anchor.to + 2}"
								>
									{anchor.text}
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</fieldset>

	{#if !locked && !preview}
		<div class="mt-2 flex justify-end">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all hover:scale-110 hover:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-md"
				onclick={submit}
				disabled={!complete}
				aria-label={t.submit}
				title={t.submit}
			>
				<i class="fa-solid fa-arrow-right"></i>
			</button>
		</div>
	{/if}
</div>
