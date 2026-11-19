<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import MessageBubble from '$lib/components/interview/MessageBubble.svelte';
	import SurveyItem from '$lib/components/interview/SurveyItem.svelte';
	import type { SurveyItemUnion } from '$lib/components/interview/types';
	import { pick, surveyItemOptions } from '$lib/guide/localized';
	import { renderSurveyItem } from '$lib/guide/render';
	import type { GuideQuestion } from '$lib/guide/types';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';
	import { describeListBounds } from '$lib/survey/list';

	import AccordionPanel from './AccordionPanel.svelte';
	import { createListReorder } from './listReorder.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		question: GuideQuestion;
		expanded?: boolean;
	}

	let { question, expanded = $bindable(false) }: Props = $props();

	// A fresh option. Options keep their id across languages and reordering;
	// conditions name them by it.
	function option() {
		return { id: crypto.randomUUID(), text: {} };
	}

	// A fresh row of a grid. Rows keep their id across languages and
	// reordering; the answer is keyed by it.
	function row() {
		return { id: crypto.randomUUID(), text: {}, required: true };
	}

	// Switch the item to `type`, keeping what the new type can use: the
	// options between the choice types (with their ids, so conditions naming
	// them still hold), the range between slider and number, and the range
	// between date and date & time, converted to the new format.
	function changeType(type: string) {
		const prev = $state.snapshot(question.survey_item);
		if (!prev || prev.type === type) return;
		// Booleans the API does not take as null are left out when unset: the
		// guide document writes an undefined as null, and drops a key left out.
		const base = prev.required == null ? {} : { required: prev.required };
		const options = surveyItemOptions(prev);
		const keptOptions = options?.length ? options : [option()];
		const withOther =
			'with_other' in prev && prev.with_other != null ? { with_other: prev.with_other } : {};
		const shuffleOptions =
			'shuffle_options' in prev && prev.shuffle_options != null
				? { shuffle_options: prev.shuffle_options }
				: {};
		const range = prev.type === 'slider' || prev.type === 'number' ? prev : null;
		const dates = prev.type === 'date' || prev.type === 'datetime' ? prev : null;
		// `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM`, the inputs' own formats.
		const asDate = (v?: string | null) => v?.slice(0, 10) || null;
		const asDatetime = (v?: string | null) =>
			v ? `${v.slice(0, 10)}T${v.slice(11, 16) || '00:00'}` : null;

		if (type === 'radio' || type === 'checkbox') {
			question.survey_item = {
				type,
				...base,
				options: keptOptions,
				...withOther,
				...shuffleOptions
			};
		} else if (type === 'likert') {
			question.survey_item = { type, ...base, options: keptOptions };
		} else if (type === 'ranking') {
			// Ranking one option is no ranking, so a single kept option gets a
			// second beside it.
			question.survey_item = {
				type,
				...base,
				options: keptOptions.length > 1 ? keptOptions : [...keptOptions, option()],
				...shuffleOptions,
				top_n: null
			};
		} else if (type === 'list') {
			question.survey_item = { type, ...base, min_entries: null, max_entries: null };
		} else if (type === 'likert_grid') {
			// The scale is the options; the rows start empty, two of them, since
			// a grid of one is a Likert item.
			question.survey_item = { type, ...base, options: keptOptions, rows: [row(), row()] };
		} else if (type === 'slider') {
			question.survey_item = {
				type,
				...base,
				min: range?.min ?? 0,
				max: range?.max ?? 10,
				step: range?.step ?? null,
				min_label: {},
				max_label: {}
			};
		} else if (type === 'number') {
			question.survey_item = {
				type,
				...base,
				min: range?.min,
				max: range?.max,
				step: range?.step
			};
		} else if (type === 'date') {
			question.survey_item = { type, ...base, min: asDate(dates?.min), max: asDate(dates?.max) };
		} else if (type === 'datetime') {
			question.survey_item = {
				type,
				...base,
				min: asDatetime(dates?.min),
				max: asDatetime(dates?.max)
			};
		} else if (type === 'time') {
			question.survey_item = { type, ...base };
		}
	}

	const guideStore = getGuideStore();

	// A list asks for exactly so many entries when its bounds are equal, and
	// otherwise for between them. Read off the bounds rather than kept apart,
	// so a collaborator's edit to them moves the control too.
	function listMode(item: { min_entries?: number | null; max_entries?: number | null }) {
		return item.min_entries != null && item.min_entries === item.max_entries
			? 'exactly'
			: 'between';
	}

	function setListMode(
		item: { min_entries?: number | null; max_entries?: number | null },
		mode: string
	) {
		if (mode === 'exactly') {
			const n = item.max_entries ?? item.min_entries ?? 3;
			item.min_entries = n;
			item.max_entries = n;
		} else {
			item.max_entries = null;
		}
	}

	// The item as a respondent in the language being edited would get it,
	// untranslated text falling back to the default language like the server's.
	let previewItem = $derived(
		renderSurveyItem(question.survey_item, guideStore.languages) as SurveyItemUnion | null
	);

	// What the preview re-mounts on: its answer state is set up once, so a
	// change to what shapes it -- the type, a Likert's display, a list's
	// bounds, a ranking's options -- starts it afresh. The state of one type
	// is meaningless, and can be out of range, for another.
	let previewKey = $derived.by(() => {
		const item = previewItem;
		if (!item) return '';
		if (item.type === 'likert') return `likert-${item.ui}`;
		if (item.type === 'list') return `list-${item.min_entries}-${item.max_entries}`;
		if (item.type === 'ranking') return `ranking-${item.options.length}-${item.top_n}`;
		return item.type ?? '';
	});

	let previewQuestion = $derived(pick(question.main_question, guideStore.languages));

	/**
	 * The preview at the width a respondent's screen gives the item: the widest
	 * the interview's answer bubble gets on a computer, or a typical phone.
	 * The phone also gets the phone layout, which the editor's own (wide)
	 * screen would otherwise never show.
	 */
	let previewDevice = $state<'desktop' | 'phone'>('desktop');
	let previewPhone = $derived(previewDevice === 'phone');
	// The respondent's bubble: `max-w-76` on a phone, `max-w-120` on a computer.
	let previewBubblePx = $derived(previewPhone ? 304 : 480);
	let previewPaneWidth = $state(0);
	// A ranking is never scaled: its options wrap like any text, so it has no
	// labels to squeeze, and dnd-kit places the option being dragged without
	// regard to `zoom`, which throws it up and to the left of the pointer.
	let previewScale = $derived(
		previewPaneWidth > 0 && question.survey_item?.type !== 'ranking'
			? Math.min(1, previewPaneWidth / previewBubblePx)
			: 1
	);

	const optionReorder = createListReorder(
		() => surveyItemOptions(question.survey_item),
		'[data-option-row]'
	);
	const rowReorder = createListReorder(
		() => (question.survey_item?.type === 'likert_grid' ? question.survey_item.rows : undefined),
		'[data-grid-row]'
	);
</script>

{#if question.survey_item}
	{@const surveyItem = question.survey_item}
	<AccordionPanel
		borderColor="border-l-indigo-500"
		bind:expanded
		removeTitle="Remove Survey Item"
		onremove={() => {
			question.survey_item = null;
			expanded = false;
		}}
	>
		{#snippet header()}
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-500"
			>
				<i class="fa-solid fa-square-poll-horizontal text-lg"></i>
			</div>
			<div class="min-w-0 flex-1 text-left">
				<div class="font-medium text-gray-700">Survey Item</div>
				<div class="text-xs text-gray-500">
					{surveyItem.type === 'likert_grid'
						? `${surveyItem.rows.length} rows · ${surveyItem.options.length}-point scale (grid)`
						: surveyItem.type === 'list'
							? `list · ${describeListBounds(surveyItem)}`
							: surveyItem.type === 'ranking' && surveyItem.top_n != null
								? `top ${surveyItem.top_n} of ${surveyItem.options.length} options (ranking)`
								: surveyItem.type === 'number' ||
									  surveyItem.type === 'date' ||
									  surveyItem.type === 'datetime' ||
									  surveyItem.type === 'time' ||
									  surveyItem.type === 'slider'
									? surveyItem.type
									: `${surveyItemOptions(surveyItem)?.length ?? 0} options (${surveyItem.type})`}
				</div>
			</div>
		{/snippet}

		<div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
			<div class="w-full max-w-sm shrink-0 space-y-4 p-2 text-sm xl:pr-0">
				<label class="mb-2 block text-gray-500">
					Type
					<select
						class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
						value={surveyItem.type}
						onchange={(e) => changeType((e.target as HTMLSelectElement).value)}
					>
						<option value="radio">Single Choice</option>
						<option value="checkbox">Multiple Choice</option>
						<option value="likert">Likert Scale</option>
						<option value="likert_grid">Likert Grid</option>
						<option value="ranking">Ranking</option>
						<option value="list">List</option>
						<option value="slider">Slider</option>
						<option value="number">Number</option>
						<option value="date">Date</option>
						<option value="datetime">Date & Time</option>
						<option value="time">Time</option>
					</select>
				</label>
				{#if surveyItem.type === 'likert_grid'}
					<div>
						<span class="mb-2 flex items-center gap-1 text-gray-500">
							Rows
							<HoverInfo
								iconColor="gray-500"
								text="The statements rated on the scale below. The main question is the grid's prompt; the respondent answers every row at once."
							></HoverInfo>
						</span>
						<div class="space-y-1">
							{#each surveyItem.rows as gridRow, rIdx (gridRow.id ?? rIdx)}
								<div
									data-grid-row
									class="flex items-center gap-1 transition-opacity"
									class:opacity-40={rowReorder.draggedIndex === rIdx}
									ondragover={(e) => rowReorder.dragOver(e, rIdx)}
									role="listitem"
								>
									<div
										data-reorder-handle
										class="cursor-grab rounded p-1 text-gray-400 outline-none hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary/40"
										title="Drag, or focus and press ↑/↓, to reorder"
										draggable="true"
										ondragstart={(e) => rowReorder.dragStart(e, rIdx)}
										ondragend={rowReorder.dragEnd}
										onkeydown={(e) => rowReorder.keydown(e, rIdx)}
										role="button"
										tabindex="0"
										aria-label="Reorder row, use the up and down arrow keys"
									>
										<i class="fa-solid fa-grip-vertical"></i>
									</div>
									<TextField
										class="flex-1 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										text={gridRow.text!}
										placeholder={`Row ${rIdx + 1}`}
									/>
									<button
										class="px-1 {gridRow.required !== false
											? 'text-red-500'
											: 'text-gray-300 hover:text-gray-500'}"
										onclick={() => (gridRow.required = gridRow.required === false)}
										title={gridRow.required !== false
											? 'Required: click to make optional'
											: 'Optional: click to make required'}
										aria-label="Toggle required"
										aria-pressed={gridRow.required !== false}
									>
										<i class="fa-solid fa-asterisk"></i>
									</button>
									<button
										class="px-1 text-gray-400 hover:text-red-500"
										onclick={() => surveyItem.rows.splice(rIdx, 1)}
										title="Remove row"
									>
										<i class="fa-solid fa-trash"></i>
									</button>
								</div>
							{/each}
							<button
								class="mt-1 text-sm font-medium text-primary hover:underline"
								onclick={() => surveyItem.rows.push(row())}
							>
								+ Add Row
							</button>
						</div>
						<label
							class="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
						>
							<input
								type="checkbox"
								class="rounded border-gray-300 text-primary focus:ring-primary"
								bind:checked={surveyItem.shuffle_rows}
							/>
							Shuffle rows
							<HoverInfo
								iconColor="gray-500"
								text="Show the rows in a random order, drawn once for each interview, so that no statement gains from always coming first."
							></HoverInfo>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'radio' || surveyItem.type === 'checkbox' || surveyItem.type === 'likert' || surveyItem.type === 'likert_grid' || surveyItem.type === 'ranking'}
					<div>
						<span class="mb-2 block text-gray-500">
							{surveyItem.type === 'likert_grid' ? 'Scale' : 'Options'}
						</span>
						<div class="space-y-1">
							{#each surveyItem.options as surveyOption, oIdx (surveyOption.id ?? oIdx)}
								<div
									data-option-row
									class="flex items-center gap-1 transition-opacity"
									class:opacity-40={optionReorder.draggedIndex === oIdx}
									ondragover={(e) => optionReorder.dragOver(e, oIdx)}
									role="listitem"
								>
									<div
										data-reorder-handle
										class="cursor-grab rounded p-1 text-gray-400 outline-none hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary/40"
										title="Drag, or focus and press ↑/↓, to reorder"
										draggable="true"
										ondragstart={(e) => optionReorder.dragStart(e, oIdx)}
										ondragend={optionReorder.dragEnd}
										onkeydown={(e) => optionReorder.keydown(e, oIdx)}
										role="button"
										tabindex="0"
										aria-label="Reorder option, use the up and down arrow keys"
									>
										<i class="fa-solid fa-grip-vertical"></i>
									</div>
									<TextField
										class="flex-1 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
										text={surveyOption.text!}
										placeholder={`Option ${oIdx + 1}`}
									/>
									<button
										class="px-1 text-gray-400 hover:text-red-500"
										onclick={() => surveyItem.options.splice(oIdx, 1)}
										title="Remove Survey Option"
									>
										<i class="fa-solid fa-trash"></i>
									</button>
								</div>
							{/each}
							<button
								class="mt-1 text-sm font-medium text-primary hover:underline"
								onclick={() => surveyItem.options.push(option())}
							>
								+ Add Option
							</button>
						</div>
					</div>
				{/if}
				{#if surveyItem.type === 'ranking'}
					<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
						<span class="flex items-center gap-1">
							Rank
							<HoverInfo
								iconColor="gray-500"
								text="Respondents drag the options into order. With a top N, only their first N choices are recorded; the rest are left unranked."
							></HoverInfo>
						</span>
						<select
							class="rounded border-gray-200 bg-gray-50 py-1.5 pr-8 pl-2 text-sm focus:border-primary focus:ring-primary/20"
							value={surveyItem.top_n == null ? 'all' : 'top'}
							onchange={(e) => {
								surveyItem.top_n =
									(e.target as HTMLSelectElement).value === 'all'
										? null
										: Math.min(3, Math.max(1, surveyItem.options.length - 1));
							}}
						>
							<option value="all">All options</option>
							<option value="top">Only the top</option>
						</select>
						{#if surveyItem.top_n != null}
							<input
								type="number"
								min="1"
								max={surveyItem.options.length}
								class="w-16 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								aria-label="How many to rank"
								bind:value={surveyItem.top_n}
							/>
						{/if}
					</div>
					{#if surveyItem.top_n != null && surveyItem.top_n > surveyItem.options.length}
						<p class="text-xs text-amber-700">
							There are only {surveyItem.options.length} options, so all of them are ranked.
						</p>
					{/if}
					<label
						class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
					>
						<input
							type="checkbox"
							class="rounded border-gray-300 text-primary focus:ring-primary"
							bind:checked={surveyItem.shuffle_options}
						/>
						Shuffle options
						<HoverInfo
							iconColor="gray-500"
							text="Start the options in a random order, drawn once for each interview, so that no option gains from starting at the top."
						></HoverInfo>
					</label>
				{/if}
				{#if surveyItem.type === 'list'}
					{@const mode = listMode(surveyItem)}
					<div class="space-y-2">
						<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
							<span class="flex items-center gap-1">
								Entries
								<HoverInfo
									iconColor="gray-500"
									text="How many answers the respondent gives, each in a field of its own. Exactly shows that many fields; between lets them add fields up to the maximum."
								></HoverInfo>
							</span>
							<select
								class="rounded border-gray-200 bg-gray-50 py-1.5 pr-8 pl-2 text-sm focus:border-primary focus:ring-primary/20"
								value={mode}
								onchange={(e) => setListMode(surveyItem, (e.target as HTMLSelectElement).value)}
							>
								<option value="between">Between</option>
								<option value="exactly">Exactly</option>
							</select>
							{#if mode === 'exactly'}
								<input
									type="number"
									min="1"
									class="w-16 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
									aria-label="Number of entries"
									value={surveyItem.min_entries}
									oninput={(e) => {
										const n = (e.target as HTMLInputElement).valueAsNumber;
										if (Number.isInteger(n) && n >= 1) {
											surveyItem.min_entries = n;
											surveyItem.max_entries = n;
										}
									}}
								/>
							{:else}
								<input
									type="number"
									min="1"
									class="w-16 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
									aria-label="Fewest entries"
									placeholder={surveyItem.required === false ? '0' : '1'}
									bind:value={surveyItem.min_entries}
								/>
								<span>and</span>
								<input
									type="number"
									min="1"
									class="w-20 rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
									aria-label="Most entries"
									placeholder="No limit"
									bind:value={surveyItem.max_entries}
								/>
							{/if}
						</div>
						{#if surveyItem.min_entries != null && surveyItem.max_entries != null && surveyItem.min_entries > surveyItem.max_entries}
							<p class="text-xs text-red-600">The fewest entries can't be more than the most.</p>
						{/if}
					</div>
				{/if}
				{#if surveyItem.type === 'radio' || surveyItem.type === 'checkbox'}
					<label
						class="mt-1 flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
					>
						<input
							type="checkbox"
							class="rounded border-gray-300 text-primary focus:ring-primary"
							bind:checked={surveyItem.with_other}
						/>
						Include "Other" option
						<HoverInfo
							iconColor="gray-500"
							text="Include and 'Other' option that allows the user to input their own answer."
						></HoverInfo>
					</label>
					<label
						class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
					>
						<input
							type="checkbox"
							class="rounded border-gray-300 text-primary focus:ring-primary"
							bind:checked={surveyItem.shuffle_options}
						/>
						Shuffle options
						<HoverInfo
							iconColor="gray-500"
							text="Show the options in a random order, drawn once for each interview, so that no option gains from always coming first. The 'Other' option stays last."
						></HoverInfo>
					</label>
				{/if}
				{#if surveyItem.type === 'likert'}
					<label class="mb-2 block text-gray-500">
						Display as
						<select
							class="mt-1 w-full rounded border-gray-200 bg-gray-50 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
							bind:value={surveyItem.ui}
						>
							<option value="radio">Radio buttons</option>
							<option value="slider">Slider</option>
						</select>
					</label>
				{/if}
				{#if surveyItem.type === 'number'}
					<div class="grid grid-cols-3 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No min"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No max"
								bind:value={surveyItem.max}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Step
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No step"
								bind:value={surveyItem.step}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'slider'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min Label
							<TextField
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="Min label..."
								text={surveyItem.min_label!}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max Label
							<TextField
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="Max label..."
								text={surveyItem.max_label!}
							/>
						</label>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No min"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No max"
								bind:value={surveyItem.max}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Step
							<input
								type="number"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								placeholder="No step"
								bind:value={surveyItem.step}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'date'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="date"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="date"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'datetime'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="datetime-local"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="datetime-local"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
				{#if surveyItem.type === 'time'}
					<div class="grid grid-cols-2 gap-2">
						<label class="mb-2 block text-sm text-gray-500">
							Min
							<input
								type="time"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.min}
							/>
						</label>
						<label class="mb-2 block text-sm text-gray-500">
							Max
							<input
								type="time"
								class="mt-1 w-full rounded border-gray-200 p-1.5 text-sm focus:border-primary focus:ring-primary/20"
								bind:value={surveyItem.max}
							/>
						</label>
					</div>
				{/if}
			</div>
			{#if previewItem}
				<div
					class="flex min-w-0 flex-1 flex-col xl:self-stretch xl:border-l xl:border-gray-200 xl:py-2 xl:pr-8 xl:pl-8"
				>
					<div class="mb-2 flex items-center justify-between gap-2">
						<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
							Preview
							<span class="font-normal tracking-normal normal-case"> — as respondents see it</span>
						</div>
						<div
							class="flex shrink-0 rounded-md border border-gray-200 bg-white p-0.5 text-xs text-gray-500"
							role="group"
							aria-label="Preview screen size"
						>
							{#each [{ device: 'desktop', icon: 'fa-desktop', label: 'Computer' }, { device: 'phone', icon: 'fa-mobile-screen-button', label: 'Phone' }] as const as option (option.device)}
								<button
									type="button"
									class="rounded px-2 py-1 transition-colors {previewDevice === option.device
										? 'bg-gray-100 text-gray-800'
										: 'hover:text-gray-700'}"
									aria-pressed={previewDevice === option.device}
									title={option.label}
									onclick={() => (previewDevice = option.device)}
								>
									<i class="fa-solid {option.icon}" aria-hidden="true"></i>
									<span class="sr-only">{option.label}</span>
								</button>
							{/each}
						</div>
					</div>
					<!-- Laid out like the respondent's chat: the question from the
					     interviewer on the left, the item to answer on the right. -->
					{#if previewQuestion}
						<div class="mb-3">
							<MessageBubble
								interviewer
								compact
								text={previewQuestion}
								lang={guideStore.lang.toUpperCase()}
							/>
						</div>
					{/if}
					<!-- Sized and styled like the respondent's answer bubble
					     (`MessageBubble`): as wide as its content up to the bubble's
					     cap, not the full cap, and with the text settings the item
					     inherits — language and hyphenation decide where labels
					     break.
					     A pane narrower than the bubble would squeeze the labels
					     into breaks a respondent never sees, so the bubble keeps
					     its width and the whole preview is scaled down instead. -->
					<div class="w-full" bind:clientWidth={previewPaneWidth}>
						<div
							class="ml-auto text-sm break-words hyphens-auto {previewItem.type === 'likert_grid' ||
							previewItem.type === 'list'
								? 'w-full'
								: 'w-fit'} {previewPhone ? 'max-w-76' : 'max-w-120'}"
							style:zoom={previewScale < 1 ? previewScale : null}
							lang={guideStore.lang}
						>
							{#key previewKey}
								<SurveyItem
									{...previewItem}
									lang={guideStore.lang.toUpperCase()}
									phone={previewPhone}
									preview
								/>
							{/key}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</AccordionPanel>
{/if}
