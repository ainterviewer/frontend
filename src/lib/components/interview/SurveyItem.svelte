<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import { getUiText } from '$lib/respondentText';
	import { CHECKBOX_SEPARATOR, splitCheckboxAnswer } from '$lib/survey/checkbox';
	import { likertLayout } from '$lib/survey/likert';

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
	let likertColumns = $derived(
		`grid-template-columns: repeat(${likertOptions.length}, minmax(0, 1fr))`
	);

	/**
	 * When a likert scale becomes a list of rows instead of a row of columns.
	 *
	 * On a phone more than five options leave each column too narrow to tap,
	 * let alone to hold a label, so the scale is stacked like a radio list
	 * there. Done in CSS rather than measured, so the server renders the right
	 * layout and nothing jumps once the page hydrates.
	 */
	let likertStack = $derived<'never' | 'phone' | 'always'>(
		likertOptions.length <= 5 ? 'never' : phone ? 'always' : 'phone'
	);
	// A column wants 1.75rem, still a comfortable tap target, which is what sizes the
	// answer bubble (it is as wide as its content), but gives way to a narrow one.
	const COLUMN =
		'w-7 max-w-full justify-self-center flex-col items-center gap-2 px-1 text-center text-xs';
	const LIKERT_STACK = {
		never: { list: 'grid', option: COLUMN, column: '', row: 'hidden', anchors: '' },
		phone: {
			list: 'grid max-sm:flex max-sm:flex-col max-sm:gap-1.5',
			option: `${COLUMN} max-sm:w-full max-sm:flex-row max-sm:gap-3 max-sm:border max-sm:border-gray-200 max-sm:bg-white max-sm:px-3 max-sm:text-left max-sm:text-sm max-sm:shadow-sm`,
			column: 'max-sm:hidden',
			row: 'hidden max-sm:inline',
			anchors: 'max-sm:hidden'
		},
		always: {
			list: 'flex flex-col gap-1.5',
			option:
				'flex-row items-center gap-3 border border-gray-200 bg-white px-3 text-left text-sm shadow-sm',
			column: 'hidden',
			row: '',
			anchors: 'hidden'
		}
	} as const;
	let stack = $derived(LIKERT_STACK[likertStack]);

	let selectOptions = $derived(
		surveyItem.type === 'radio' || surveyItem.type === 'checkbox'
			? surveyItem.options.map((opt: string) => ({ label: opt, value: opt }))
			: []
	);

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
		{onAnswer}
	/>
{:else}
	<div class="w-full max-w-full min-w-60">
		<fieldset
			class="flex flex-wrap gap-1.5 rounded-2xl border border-gray-100 bg-gray-200 p-4 sm:gap-2
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
					<input
						type="range"
						min={sliderMin}
						max={sliderMax}
						step={sliderStep}
						bind:value={sliderValue}
						disabled={disabled && !readonly}
						class="my-6 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
						list={sliderTicksId}
					/>
					{#if sliderTicks.length <= 20}
						<datalist id={sliderTicksId}>
							{#each sliderTicks as tick (tick)}
								<option value={tick}>{tick}</option>
							{/each}
						</datalist>
					{/if}
					<div class="flex justify-between text-xs font-medium text-gray-600">
						<span>{surveyItem.min_label ?? sliderMin}</span>
						<span class="font-semibold text-gray-800">{sliderValue}</span>
						<span>{surveyItem.max_label ?? sliderMax}</span>
					</div>
				</div>
			{:else if surveyItem.type === 'likert' && surveyItem.ui === 'slider'}
				<div class="w-full px-2">
					<input
						type="range"
						min="0"
						max={likertOptions.length - 1}
						step="1"
						bind:value={sliderValue}
						disabled={disabled && !readonly}
						class="my-6 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
						list={likertTicksId}
					/>

					<datalist id={likertTicksId}>
						{#each likertOptions as opt, i (i)}
							<option value={i} label={opt}></option>
						{/each}
					</datalist>
					<div class="flex justify-between gap-4 text-xs font-medium text-gray-600">
						{#each likertOptions as opt, i (i)}
							<span
								class="flex-1 text-center first:text-left last:text-right {i === sliderValue
									? 'font-bold text-primary'
									: ''}"
							>
								{opt}
							</span>
						{/each}
					</div>
				</div>
			{:else if surveyItem.type === 'likert'}
				<!-- The words of a numbered scale ("1. Not at all worried") go in
				     a row of their own under it, where they can span the columns
				     beside them; see `likertLayout`. Hyphenation is off: a label
				     split into syllables reads worse than one that wraps. -->
				<div class="w-full pb-1">
					<div class="gap-x-1 {stack.list}" style={likertColumns}>
						{#each likertOptions as opt, i (i)}
							{@const tick = likert.ticks[i]}
							<label
								class="flex rounded-xl py-2 font-medium break-words [hyphens:manual] text-gray-700 transition-all {stack.option}
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
									<span>{opt}</span>
								{:else}
									<span class={stack.column}>{tick}</span>
									<span class={stack.row}>{opt}</span>
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
                   sm:px-4 sm:py-3
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
                   sm:px-4 sm:py-3
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
								class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-3"
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
