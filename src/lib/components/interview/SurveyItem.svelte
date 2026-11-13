<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import { getUiText } from '$lib/respondentText';
	import { CHECKBOX_SEPARATOR, splitCheckboxAnswer } from '$lib/survey/checkbox';
	import type { GivesWay } from '$lib/survey/likert';
	import {
		givesWay,
		likertCompactMinWidth,
		likertLayout,
		likertMinWidth,
		sliderLabelsMinWidth
	} from '$lib/survey/likert';

	import SurveyGrid from './SurveyGrid.svelte';
	import type { SurveyItemUnion } from './types';

	let {
		onAnswer,
		readonly = false,
		preview = false,
		answer = '',
		lang = 'EN',
		phone = false,
		...surveyItem
	}: SurveyItemUnion & {
		onAnswer?: (value: unknown) => void;
		readonly?: boolean;
		/** Interactive but never submitted: the guide editor's live preview. */
		preview?: boolean;
		answer?: string;
		lang?: string;
		/** Lay out as on a phone whatever the screen: the editor's phone preview. */
		phone?: boolean;
	} = $props();

	let t = $derived(getUiText(lang).survey);
	/** The roomier option rows a screen from `sm` up gets, unless previewing a phone. */
	let roomy = $derived(phone ? '' : 'sm:px-4 sm:py-3');

	let sliderValue = $state(0);
	const selectedValues = new SvelteSet<string>();
	let radioValue = $state('');
	let numberValue = $state<number | null>(null);
	let dateValue = $state('');
	let timeValue = $state('');
	let otherSelected = $state(false);
	let otherText = $state('');

	let submitted = $state(false);
	let disabled = $derived(readonly || submitted);

	const uid = $props.id();
	const groupName = `survey-option-${uid}`;
	const sliderTicksId = `slider-ticks-${uid}`;
	const likertTicksId = `likert-ticks-${uid}`;

	// A range input shows its thumb at `min` when its value is below it, but
	// the bound value stays where it was: start it there, or an untouched
	// slider submits a value outside its own range.
	untrack(() => {
		if (surveyItem.type === 'slider') sliderValue = surveyItem.min ?? 0;
	});

	untrack(() => {
		if (!readonly || !answer) return;
		if (surveyItem.type === 'slider') {
			sliderValue = Number(answer);
		} else if (surveyItem.type === 'likert') {
			if (surveyItem.ui === 'slider') {
				const idx = surveyItem.options.indexOf(answer);
				if (idx >= 0) sliderValue = idx;
			} else {
				radioValue = answer;
			}
		} else if (surveyItem.type === 'radio') {
			if (surveyItem.options.includes(answer)) {
				radioValue = answer;
			} else {
				otherSelected = true;
				otherText = answer;
			}
		} else if (surveyItem.type === 'number') {
			numberValue = Number(answer);
		} else if (surveyItem.type === 'date' || surveyItem.type === 'datetime') {
			dateValue = answer;
		} else if (surveyItem.type === 'time') {
			timeValue = answer;
		} else if (surveyItem.type === 'checkbox') {
			const parts = splitCheckboxAnswer(answer, surveyItem.options);
			const opts = new Set<string>(surveyItem.options);
			for (const p of parts) {
				if (opts.has(p)) {
					selectedValues.add(p);
				} else {
					otherSelected = true;
					otherText = p;
				}
			}
		}
	});

	// Slider defaults
	let sliderMin = $derived(surveyItem.type === 'slider' ? (surveyItem.min ?? 0) : 0);
	let sliderMax = $derived(surveyItem.type === 'slider' ? (surveyItem.max ?? 100) : 100);
	let sliderStep = $derived(surveyItem.type === 'slider' ? (surveyItem.step ?? 1) : 1);
	let sliderTicks = $derived.by(() => {
		if (surveyItem.type !== 'slider') return [];
		const ticks: number[] = [];
		for (let v = sliderMin; v <= sliderMax; v += sliderStep) {
			ticks.push(v);
		}
		return ticks;
	});

	let numberError = $derived.by(() => {
		if (surveyItem.type !== 'number' || numberValue === null) return '';
		if (surveyItem.min != null && numberValue < surveyItem.min)
			return `${t.mustBeAtLeast} ${surveyItem.min}`;
		if (surveyItem.max != null && numberValue > surveyItem.max)
			return `${t.mustBeAtMost} ${surveyItem.max}`;
		return '';
	});

	let likertOptions = $derived(surveyItem.type === 'likert' ? surveyItem.options : []);
	let likert = $derived(likertLayout(likertOptions));
	// Equal columns. One of words is never narrower than its longest word:
	// should `likertStack` misjudge the room by a little, a column takes a
	// few pixels from its neighbours rather than break a word mid-way.
	let likertColumns = $derived(
		`grid-template-columns: repeat(${likertOptions.length}, minmax(${likert.narrow ? '0' : 'min-content'}, 1fr))`
	);

	/**
	 * When a likert scale's columns get compact, and when they become a list
	 * of rows.
	 *
	 * Columns keep each label's words whole while they fit, since a label
	 * broken mid-word ("Overve / jende") is unreadable. Where they do not,
	 * the columns get compact, as a Likert grid's cards on a phone: smaller
	 * text, less padding, and a long word may hyphenate ("Hver-ken"). Only a
	 * scale that does not fit even so becomes rows. The answer bubble is
	 * about 300px wide on a phone, and on a computer from about 380px in a
	 * window just over `sm` to 480px from `md` up (`givesWay`). Decided from
	 * the text rather than measured, so the server renders the right layout
	 * and nothing jumps once the page hydrates.
	 */
	let likertStack = $derived(givesWay(likertCompactMinWidth(likert), false, phone));
	let likertCompact = $derived.by((): GivesWay | 'rows' => {
		// Rows everywhere: they size themselves.
		if (likertStack === 'always') return 'rows';
		const whole = likert.narrow ? likertStack : givesWay(likertMinWidth(likert), false, phone);
		// Where the rows take over, the compact step is moot.
		return whole === likertStack ? 'never' : whole;
	});
	// The columns' size, set here once per width so that no two classes set
	// the same property at the same width; the rows' own (`LIKERT_STACK`)
	// carry a breakpoint, and win where they apply.
	const COMPACT = {
		rows: { list: '', option: '' },
		never: { list: 'gap-x-1', option: 'px-1 text-xs' },
		sm: {
			list: 'gap-x-1 max-sm:gap-x-0',
			option: 'px-1 text-xs max-sm:px-0.5 max-sm:text-[0.6875rem]'
		},
		md: {
			list: 'gap-x-1 max-md:gap-x-0',
			option: 'px-1 text-xs max-md:px-0.5 max-md:text-[0.6875rem]'
		},
		always: { list: 'gap-x-0', option: 'px-0.5 text-[0.6875rem]' }
	} as const;
	let compact = $derived(COMPACT[likertCompact]);
	const COLUMN = 'flex-col items-center gap-2 py-2 text-center';
	const LIKERT_STACK = {
		never: { list: 'grid', option: COLUMN, column: '', row: 'hidden', anchors: '' },
		sm: {
			list: 'grid max-sm:flex max-sm:flex-col max-sm:gap-1',
			option: `${COLUMN} max-sm:w-full max-sm:flex-row max-sm:gap-3 max-sm:py-1.5 max-sm:border max-sm:border-gray-200 max-sm:bg-white max-sm:px-3 max-sm:text-left max-sm:text-sm max-sm:shadow-sm`,
			column: 'max-sm:hidden',
			row: 'hidden max-sm:inline',
			anchors: 'max-sm:hidden'
		},
		md: {
			list: 'grid max-md:flex max-md:flex-col max-md:gap-1',
			option: `${COLUMN} max-md:w-full max-md:flex-row max-md:gap-3 max-md:py-1.5 max-md:border max-md:border-gray-200 max-md:bg-white max-md:px-3 max-md:text-left max-md:text-sm max-md:shadow-sm`,
			column: 'max-md:hidden',
			row: 'hidden max-md:inline',
			anchors: 'max-md:hidden'
		},
		always: {
			list: 'flex flex-col gap-1',
			option:
				'flex-row items-center gap-3 border border-gray-200 bg-white px-3 py-1.5 text-left text-sm shadow-sm',
			column: 'hidden',
			row: '',
			anchors: 'hidden'
		}
	} as const;
	let stack = $derived(LIKERT_STACK[likertStack]);

	/**
	 * How a column is sized, and how its label breaks.
	 *
	 * A column of a number wants 1.75rem, still a comfortable tap target,
	 * which is what sizes the answer bubble (it is as wide as its content),
	 * and gives way when the bubble is narrower. A column of words fills its
	 * share of the row and wraps between words; `likertStack` keeps columns
	 * only where every word fits whole, or compact ones where a word of seven
	 * letters or more may hyphenate.
	 */
	let likertColumn = $derived(
		likert.narrow
			? `[hyphens:manual] ${likertStack === 'always' ? '' : 'w-7 max-w-full justify-self-center'}`
			: 'w-full hyphens-auto [hyphenate-limit-chars:7_3_3]'
	);

	/**
	 * A Likert slider names every point under the track where the words fit
	 * whole, and only its two ends where they do not; the chosen point is
	 * named above the track either way.
	 */
	let sliderLabels = $derived(
		{
			never: { all: 'grid', ends: 'hidden' },
			sm: { all: 'grid max-sm:hidden', ends: 'hidden max-sm:flex' },
			md: { all: 'grid max-md:hidden', ends: 'hidden max-md:flex' },
			always: { all: 'hidden', ends: 'flex' }
		}[givesWay(sliderLabelsMinWidth(likertOptions), false, phone)]
	);

	/**
	 * The options in the order this interview shows them: `option_order`,
	 * drawn when the interview started, where the item shuffles its options.
	 * `options` itself stays as authored.
	 */
	let selectOptions = $derived.by(() => {
		if (surveyItem.type !== 'radio' && surveyItem.type !== 'checkbox') return [];
		const { options, option_order } = surveyItem;
		const shown =
			option_order?.length === options.length ? option_order.map((n) => options[n]) : options;
		return shown.map((opt: string) => ({ label: opt, value: opt }));
	});

	let hasAnswer = $derived.by(() => {
		if (surveyItem.type === 'slider') return true;
		if (surveyItem.type === 'likert') {
			if (surveyItem.ui === 'slider') return true;
			return radioValue !== '';
		}
		if (surveyItem.type === 'radio')
			return otherSelected ? otherText.trim() !== '' : radioValue !== '';
		if (surveyItem.type === 'number') return numberValue !== null && numberError === '';
		if (surveyItem.type === 'date') return dateValue !== '';
		if (surveyItem.type === 'datetime') return dateValue !== '';
		if (surveyItem.type === 'time') return timeValue !== '';
		// checkbox
		const hasSelection = selectedValues.size > 0;
		const hasOther = otherSelected && otherText.trim() !== '';
		return hasSelection || hasOther;
	});

	function toggleOption(value: string) {
		if (disabled) return;

		if (surveyItem.type === 'radio' || surveyItem.type === 'likert') {
			radioValue = value;
			otherSelected = false;
		} else {
			if (selectedValues.has(value)) {
				selectedValues.delete(value);
			} else {
				selectedValues.add(value);
			}
		}
	}

	function isChecked(value: string) {
		// `''` is "nothing chosen", so an option without text is never it.
		if (surveyItem.type === 'radio' || surveyItem.type === 'likert')
			return radioValue !== '' && radioValue === value;
		return selectedValues.has(value);
	}

	function selectOther() {
		if (disabled) return;
		if (surveyItem.type === 'radio') {
			radioValue = '';
			otherSelected = true;
		} else {
			otherSelected = !otherSelected;
		}
	}

	function sendAnswer() {
		if (disabled) return;

		let answer: string[] = [];
		if (surveyItem.type === 'slider') {
			answer = [String(sliderValue)];
		} else if (surveyItem.type === 'likert') {
			if (surveyItem.ui === 'slider') {
				const selectedOption = likertOptions[sliderValue];
				if (selectedOption) {
					answer = [selectedOption];
				}
			} else {
				if (radioValue) answer = [radioValue];
			}
		} else if (surveyItem.type === 'radio') {
			if (otherSelected && otherText) answer = [otherText];
			else if (radioValue) answer = [radioValue];
		} else if (surveyItem.type === 'number') {
			if (numberValue !== null) answer = [String(numberValue)];
		} else if (surveyItem.type === 'date') {
			if (dateValue) answer = [dateValue];
		} else if (surveyItem.type === 'datetime') {
			if (dateValue) answer = [dateValue];
		} else if (surveyItem.type === 'time') {
			if (timeValue) answer = [timeValue];
		} else {
			// checkbox
			answer = Array.from(selectedValues);
			if (otherSelected && otherText) answer.push(otherText);
		}

		if (surveyItem.required && answer.length === 0) {
			alert(t.pleaseProvideValue);
			return;
		}

		submitted = true;
		onAnswer?.(answer.join(CHECKBOX_SEPARATOR));
	}

	function getLegendText() {
		switch (surveyItem.type) {
			case 'slider':
				return t.pickValue;
			case 'likert':
				return surveyItem.ui === 'slider' ? t.pickValue : t.chooseOne;
			case 'radio':
				return t.chooseOne;
			case 'number':
				return t.enterNumber;
			case 'date':
				return t.pickDate;
			case 'datetime':
				return t.pickDateTime;
			case 'time':
				return t.pickTime;
			default:
				return t.selectMultiple;
		}
	}
</script>

{#if surveyItem.type === 'likert_grid'}
	<SurveyGrid
		rows={surveyItem.rows}
		options={surveyItem.options}
		{answer}
		{readonly}
		{preview}
		{lang}
		{phone}
		{onAnswer}
	/>
{:else}
	<div class="w-full max-w-full min-w-60">
		<fieldset
			class="flex flex-wrap gap-1.5 rounded-2xl border border-gray-100 bg-gray-200 p-4 {phone
				? ''
				: 'sm:gap-2'}
            {surveyItem.type === 'radio' || surveyItem.type === 'checkbox' ? 'flex-col' : ''}
            {readonly ? 'pointer-events-none' : ''}"
		>
			<legend
				class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
			>
				{getLegendText()}
			</legend>

			{#if surveyItem.type === 'slider'}
				<div class="w-full px-2">
					<output class="block text-center text-sm font-semibold text-gray-800"
						>{sliderValue}</output
					>
					<input
						type="range"
						min={sliderMin}
						max={sliderMax}
						step={sliderStep}
						bind:value={sliderValue}
						disabled={disabled && !readonly}
						class="mt-2 mb-4 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
						list={sliderTicksId}
					/>
					{#if sliderTicks.length <= 20}
						<datalist id={sliderTicksId}>
							{#each sliderTicks as tick (tick)}
								<option value={tick}>{tick}</option>
							{/each}
						</datalist>
					{/if}
					<div
						class="flex justify-between gap-4 text-xs font-medium break-words text-gray-600 [hyphenate-limit-chars:7_3_3]"
					>
						<span class="max-w-[45%] text-left">{surveyItem.min_label ?? sliderMin}</span>
						<span class="max-w-[45%] text-right">{surveyItem.max_label ?? sliderMax}</span>
					</div>
				</div>
			{:else if surveyItem.type === 'likert' && surveyItem.ui === 'slider'}
				<!-- The track runs from the middle of the first label's column to
				     the middle of the last's, so each point sits over its label. -->
				<div class="w-full px-2">
					<output class="block min-h-5 text-center text-sm font-semibold text-primary"
						>{likertOptions[sliderValue] ?? ''}</output
					>
					<input
						type="range"
						min="0"
						max={likertOptions.length - 1}
						step="1"
						bind:value={sliderValue}
						disabled={disabled && !readonly}
						aria-valuetext={likertOptions[sliderValue]}
						class="mt-2 mb-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
						style:margin-inline="calc(50% / {likertOptions.length})"
						style:width="calc(100% - 100% / {likertOptions.length})"
						list={likertTicksId}
					/>

					<datalist id={likertTicksId}>
						{#each likertOptions as opt, i (i)}
							<option value={i} label={opt}></option>
						{/each}
					</datalist>
					<div
						class="gap-x-1 text-xs font-medium break-words hyphens-auto text-gray-600 [hyphenate-limit-chars:7_3_3] {sliderLabels.all}"
						style:grid-template-columns="repeat({likertOptions.length}, minmax(0, 1fr))"
						aria-hidden="true"
					>
						{#each likertOptions as opt, i (i)}
							<span class="text-center {i === sliderValue ? 'font-bold text-primary' : ''}"
								>{opt}</span
							>
						{/each}
					</div>
					<div
						class="justify-between gap-4 text-xs font-medium break-words text-gray-600 {sliderLabels.ends}"
						aria-hidden="true"
					>
						<span class="max-w-[45%] text-left">{likertOptions[0]}</span>
						<span class="max-w-[45%] text-right">{likertOptions.at(-1)}</span>
					</div>
				</div>
			{:else if surveyItem.type === 'likert'}
				<!-- The words of a scale worded only on some points ("1. Not at all
				     worried", "2", …, or "Disagree", "", …) go in a row of their
				     own under it, where they can span the columns of the
				     unlabelled points beside them; see `likertLayout`. Hyphenation is off: a label
				     split into syllables reads worse than one that wraps. -->
				<div class="w-full pb-1">
					<div class="{stack.list} {compact.list}" style={likertColumns}>
						{#each likertOptions as opt, i (i)}
							{@const tick = likert.ticks[i]}
							<label
								class="flex rounded-xl font-medium break-words text-gray-700 transition-all {likertColumn} {stack.option} {compact.option}
                  {disabled && !readonly
									? 'cursor-not-allowed opacity-60 grayscale'
									: disabled
										? 'cursor-default'
										: 'cursor-pointer hover:border-primary/50 hover:bg-gray-300'}"
							>
								<input
									type="radio"
									id="{groupName}-{i}"
									name={groupName}
									value={opt}
									aria-label={tick === opt ? undefined : opt}
									checked={isChecked(opt)}
									onchange={() => toggleOption(opt)}
									disabled={disabled && !readonly}
									class="h-4 w-4 shrink-0 border-gray-300 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
								/>
								{#if tick === opt}
									<!-- A break allowed after a slash; see `labelWords`. -->
									<span class="max-w-full"
										>{#each opt.split('/') as part, k (k)}{#if k > 0}/<wbr
												/>{/if}{part}{/each}</span
									>
								{:else}
									<span class="max-w-full {stack.column}">{tick}</span>
									<span class="max-w-full {stack.row}">{opt}</span>
								{/if}
							</label>
						{/each}
					</div>
					{#if likert.anchors.length > 0}
						<!-- Hidden from screen readers: each radio already carries
						     its option's full text. Still a click target.
						     A tick drops from each worded number to its words, and
						     the words are kept narrow and balanced ("Slet ikke /
						     bekymret") so they stay by the end they name instead of
						     reading as a caption for the whole row. -->
						<div
							class="-mt-1.5 grid gap-x-1 text-xs leading-tight font-medium break-words [hyphens:manual] text-gray-600 {stack.anchors}"
							style={likertColumns}
							aria-hidden="true"
						>
							{#each likert.anchors as anchor (anchor.index)}
								<span
									class="h-2 w-px justify-self-center bg-gray-400"
									style="grid-row: 1; grid-column: {anchor.index + 1}"
									data-likert-tick
								></span>
								<label
									for="{groupName}-{anchor.index}"
									class="mt-1 min-w-min text-balance {anchor.align === 'left'
										? 'max-w-[6em] justify-self-start text-left'
										: anchor.align === 'right'
											? 'max-w-[6em] justify-self-end text-right'
											: 'max-w-[8em] justify-self-center text-center'} {disabled
										? ''
										: 'cursor-pointer'}"
									style="grid-row: 2; grid-column: {anchor.from + 1} / {anchor.to + 2}"
								>
									{anchor.text}
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{:else if surveyItem.type === 'number'}
				<div class="w-full px-2">
					<input
						type="number"
						bind:value={numberValue}
						min={surveyItem.min ?? undefined}
						max={surveyItem.max ?? undefined}
						step={surveyItem.step ?? undefined}
						disabled={disabled && !readonly}
						class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
						class:focus:ring-red-500={numberError}
						class:focus:border-red-500={numberError}
						placeholder={t.enterNumber}
					/>
					{#if numberError}
						<p class="mt-1 text-xs text-red-500">{numberError}</p>
					{/if}
				</div>
			{:else if surveyItem.type === 'date'}
				<div class="w-full px-2">
					<input
						type="date"
						bind:value={dateValue}
						min={surveyItem.min ?? undefined}
						max={surveyItem.max ?? undefined}
						disabled={disabled && !readonly}
						class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
					/>
				</div>
			{:else if surveyItem.type === 'datetime'}
				<div class="w-full px-2">
					<input
						type="datetime-local"
						bind:value={dateValue}
						min={surveyItem.min ?? undefined}
						max={surveyItem.max ?? undefined}
						disabled={disabled && !readonly}
						class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
					/>
				</div>
			{:else if surveyItem.type === 'time'}
				<div class="w-full px-2">
					<input
						type="time"
						bind:value={timeValue}
						min={surveyItem.min ?? undefined}
						max={surveyItem.max ?? undefined}
						disabled={disabled && !readonly}
						class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
					/>
				</div>
			{:else}
				<!-- radio / checkbox -->
				{#each selectOptions as opt, i (i)}
					<div class="relative max-w-full min-w-min">
						<label
							class="flex w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-primary/50 hover:bg-gray-200
                   {roomy}
                   {isChecked(opt.value)
								? 'border-primary bg-primary/10 text-dark ring-1 ring-primary'
								: ''}
                  {disabled && !readonly
								? 'cursor-not-allowed opacity-60 grayscale'
								: disabled
									? 'cursor-default'
									: ''}"
						>
							<input
								type={surveyItem.type}
								name={groupName}
								value={opt.value}
								checked={isChecked(opt.value)}
								onchange={() => toggleOption(opt.value)}
								disabled={disabled && !readonly}
								class="mr-3 h-4 w-4 border-gray-300 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
							/>
							{opt.label}
						</label>
					</div>
				{/each}
				{#if (surveyItem.type === 'radio' || surveyItem.type === 'checkbox') && surveyItem.with_other}
					<div class="relative max-w-full min-w-min">
						<label
							class="flex w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-primary/50 hover:bg-gray-200
                   {roomy}
                   {otherSelected
								? 'border-primary bg-primary/10 text-dark ring-1 ring-primary'
								: ''}
                  {disabled && !readonly
								? 'cursor-not-allowed opacity-60 grayscale'
								: disabled
									? 'cursor-default'
									: ''}"
						>
							<input
								type={surveyItem.type}
								name={groupName}
								value="__other__"
								checked={otherSelected}
								onchange={selectOther}
								disabled={disabled && !readonly}
								class="mr-3 h-4 w-4 border-gray-300 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
							/>
							{t.other}
						</label>
					</div>
					{#if otherSelected}
						<div class="w-full">
							<input
								type="text"
								bind:value={otherText}
								disabled={disabled && !readonly}
								class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 {roomy}"
								placeholder={t.pleaseSpecify}
							/>
						</div>
					{/if}
				{/if}
			{/if}
		</fieldset>

		{#if !disabled && !readonly && !preview}
			<div class="mt-2 flex justify-end">
				<button
					class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all hover:scale-110 hover:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-md"
					onclick={sendAnswer}
					disabled={!hasAnswer}
					aria-label="Submit answer"
				>
					<i class="fa-solid fa-arrow-right"></i>
				</button>
			</div>
		{/if}
	</div>
{/if}
