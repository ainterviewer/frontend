<script lang="ts">
	import { untrack } from 'svelte';

	import type { GridRow } from '$lib/api';
	import { encodeGridAnswer, parseGridAnswer } from '$lib/survey/grid';

	/**
	 * A Likert grid: several statements rated on one scale, answered as one.
	 *
	 * The answer is a JSON object from row id to the chosen option
	 * (`encodeGridAnswer`), a row left blank absent from it -- the library's
	 * `LikertGridItem.encode_answer`.
	 *
	 * A table from `sm` up, columns for the scale as on paper; below it, where
	 * five columns of radio buttons do not fit, each row is a card of its own
	 * with the scale as buttons.
	 */
	let {
		rows,
		options,
		answer = '',
		readonly = false,
		preview = false,
		lang = 'EN',
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
		onAnswer?: (answer: string) => void;
	} = $props();

	type StringKey = 'rateEach' | 'required' | 'submit' | 'clear';

	const TRANSLATIONS: Record<string, Record<StringKey, string>> = {
		EN: { rateEach: 'Rate each', required: 'Required', submit: 'Submit answers', clear: 'Clear' },
		DA: { rateEach: 'Vurder hver', required: 'Påkrævet', submit: 'Send svar', clear: 'Ryd' },
		DE: {
			rateEach: 'Bewerte jede',
			required: 'Erforderlich',
			submit: 'Antworten senden',
			clear: 'Zurücksetzen'
		},
		ES: {
			rateEach: 'Valora cada una',
			required: 'Obligatorio',
			submit: 'Enviar respuestas',
			clear: 'Borrar'
		},
		FR: {
			rateEach: 'Évaluez chacun',
			required: 'Obligatoire',
			submit: 'Envoyer les réponses',
			clear: 'Effacer'
		}
	};

	let t = $derived(TRANSLATIONS[lang.toUpperCase()] ?? TRANSLATIONS.EN);

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

<!-- `lang` so the scale's headings hyphenate by the respondent's language. -->
<div class="w-full max-w-full min-w-60" lang={lang.toLowerCase()}>
	<fieldset
		class="rounded-2xl border border-gray-100 bg-gray-200 p-3 sm:p-4 {locked
			? 'pointer-events-none'
			: ''}"
	>
		<legend
			class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
		>
			{t.rateEach}
		</legend>

		<!-- Wide: one table, the scale across the top. -->
		<div class="hidden overflow-x-auto sm:block">
			<!-- Fixed layout: the statement column gets a set share and the scale
			     points split the rest evenly, so a short label is never squeezed
			     into a hyphenated sliver and the columns line up under their
			     headings. The white is on the cells, not the row: a table row
			     cannot take rounded corners. -->
			<table class="w-full table-fixed border-separate border-spacing-y-1.5 text-sm">
				<colgroup>
					<col class="w-[30%]" />
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
								class="px-1 pb-1 text-center align-bottom text-xs leading-tight font-medium break-words hyphens-auto text-gray-600"
							>
								{option}
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
		<div class="flex flex-col gap-2 sm:hidden">
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
					<div class="flex w-full items-stretch">
						{#each options as option, o (o)}
							<label
								class="flex flex-1 basis-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg px-0.5 py-2 text-center text-[0.6875rem] leading-tight font-medium break-words hyphens-auto text-gray-600 transition-colors hover:bg-gray-100"
							>
								<input
									type="radio"
									name="grid-m-{uid}-{r}"
									value={option}
									checked={chosen[row.id ?? ''] === option}
									onclick={() => toggle(row, option)}
									onchange={() => choose(row, option)}
									disabled={submitted && !readonly}
									class="h-[1.125rem] w-[1.125rem] border-gray-400 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
								/>
								<span>{option}</span>
							</label>
						{/each}
					</div>
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
