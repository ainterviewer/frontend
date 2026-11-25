<script lang="ts">
	import { tick, untrack } from 'svelte';

	import { getUiText } from '$lib/respondentText';
	import {
		encodeListAnswer,
		fewestEntries,
		fixedEntries,
		initialEntries,
		parseListAnswer
	} from '$lib/survey/list';

	/**
	 * A list item: several answers of the respondent's own, one field each,
	 * answered as one.
	 *
	 * Equal bounds ask for exactly that many, and show that many fields with
	 * nothing to add or remove; otherwise the list starts with the fields it
	 * needs and the respondent adds more, up to the maximum. The answer is a
	 * JSON array of the entries (`encodeListAnswer`) -- the library's
	 * `ListItem.encode_answer`.
	 */
	let {
		min_entries = null,
		max_entries = null,
		required = true,
		answer = '',
		readonly = false,
		preview = false,
		lang = 'EN',
		phone = false,
		onAnswer
	}: {
		min_entries?: number | null;
		max_entries?: number | null;
		required?: boolean;
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

	let t = $derived(getUiText(lang).list);

	let bounds = $derived({ min_entries, max_entries, required });
	let fixed = $derived(fixedEntries(bounds));
	let fewest = $derived(fewestEntries(bounds));

	// Seeded once: from a submitted answer, or with the fields the list needs.
	let entries = $state<string[]>(
		untrack(() =>
			readonly && answer
				? parseListAnswer(answer)
				: Array.from({ length: initialEntries(bounds) }, () => '')
		)
	);
	let submitted = $state(false);
	let locked = $derived(readonly || submitted);

	let filled = $derived(entries.filter((entry) => entry.trim()).length);
	let complete = $derived(filled >= fewest);
	let canAdd = $derived(fixed == null && (max_entries == null || entries.length < max_entries));
	let canRemove = $derived(fixed == null && entries.length > fewest);

	let fields: HTMLInputElement[] = $state([]);
	const uid = $props.id();

	async function add() {
		if (locked || !canAdd) return;
		entries.push('');
		await tick();
		fields[entries.length - 1]?.focus();
	}

	function remove(index: number) {
		if (locked || !canRemove) return;
		entries.splice(index, 1);
	}

	// Enter goes on to the next field, adding one at the end while more are
	// allowed, as a list typed on paper goes on to the next line.
	function onkeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (index < entries.length - 1) fields[index + 1]?.focus();
		else if (canAdd && entries[index].trim()) add();
	}

	function submit() {
		if (locked || !complete) return;
		// `false`: not sent (the connection is down), so leave it open.
		if (onAnswer?.(encodeListAnswer(entries)) === false) return;
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
			{fixed != null ? t.legendExactly(fixed) : t.legend}
		</legend>

		<ol class="flex flex-col gap-1.5">
			{#each entries as _, index (index)}
				<li class="flex items-center gap-2">
					<span class="w-5 shrink-0 text-end text-xs font-medium text-gray-500 tabular-nums">
						{index + 1}.
					</span>
					<input
						bind:this={fields[index]}
						bind:value={entries[index]}
						id="list-{uid}-{index}"
						type="text"
						dir={entries[index] ? 'auto' : undefined}
						class="min-w-0 flex-1 rounded-lg border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-700"
						placeholder={t.entry(index + 1)}
						aria-label={t.entry(index + 1)}
						disabled={locked}
						onkeydown={(event) => onkeydown(event, index)}
					/>
					{#if canRemove && !locked}
						<button
							type="button"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
							onclick={() => remove(index)}
							title={t.remove}
							aria-label="{t.remove}: {t.entry(index + 1)}"
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					{/if}
				</li>
			{/each}
		</ol>

		{#if canAdd && !locked}
			<button
				type="button"
				class="ms-7 mt-2 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-white/60 focus:ring-2 focus:ring-primary focus:outline-none"
				onclick={add}
			>
				<i class="fa-solid fa-plus me-1 text-xs" aria-hidden="true"></i>
				{t.add}
			</button>
		{/if}
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
				<i class="fa-solid fa-arrow-right rtl:-scale-x-100"></i>
			</button>
		</div>
	{/if}
</div>
