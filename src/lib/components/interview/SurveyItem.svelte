<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { SurveyItemUnion } from './types';

	let {
		onAnswer,
		readonly = false,
		answer = '',
		lang = 'EN',
		...surveyItem
	} = $props<
		SurveyItemUnion & {
			onAnswer?: (value: unknown) => void;
			readonly?: boolean;
			answer?: string;
			lang?: string;
		}
	>();

	type StringKey =
		| 'pickValue'
		| 'chooseOne'
		| 'enterNumber'
		| 'pickDate'
		| 'pickDateTime'
		| 'pickTime'
		| 'selectMultiple'
		| 'other'
		| 'pleaseSpecify'
		| 'mustBeAtLeast'
		| 'mustBeAtMost'
		| 'pleaseProvideValue';

	const TRANSLATIONS: Record<string, Record<StringKey, string>> = {
		EN: {
			pickValue: 'Pick a value',
			chooseOne: 'Choose one',
			enterNumber: 'Enter a number',
			pickDate: 'Pick a date',
			pickDateTime: 'Pick a date and time',
			pickTime: 'Pick a time',
			selectMultiple: 'Select multiple',
			other: 'Other',
			pleaseSpecify: 'Please specify...',
			mustBeAtLeast: 'Must be at least',
			mustBeAtMost: 'Must be at most',
			pleaseProvideValue: 'Please provide a value'
		},
		DA: {
			pickValue: 'Vælg en værdi',
			chooseOne: 'Vælg én',
			enterNumber: 'Indtast et tal',
			pickDate: 'Vælg en dato',
			pickDateTime: 'Vælg dato og tid',
			pickTime: 'Vælg et tidspunkt',
			selectMultiple: 'Vælg flere',
			other: 'Andet',
			pleaseSpecify: 'Angiv venligst...',
			mustBeAtLeast: 'Skal mindst være',
			mustBeAtMost: 'Må højst være',
			pleaseProvideValue: 'Angiv venligst en værdi'
		},
		DE: {
			pickValue: 'Wert auswählen',
			chooseOne: 'Wähle eine Option',
			enterNumber: 'Zahl eingeben',
			pickDate: 'Datum auswählen',
			pickDateTime: 'Datum und Uhrzeit auswählen',
			pickTime: 'Uhrzeit auswählen',
			selectMultiple: 'Mehrere auswählen',
			other: 'Andere',
			pleaseSpecify: 'Bitte angeben...',
			mustBeAtLeast: 'Muss mindestens sein',
			mustBeAtMost: 'Darf höchstens sein',
			pleaseProvideValue: 'Bitte einen Wert angeben'
		},
		ES: {
			pickValue: 'Elige un valor',
			chooseOne: 'Elige una opción',
			enterNumber: 'Introduce un número',
			pickDate: 'Elige una fecha',
			pickDateTime: 'Elige fecha y hora',
			pickTime: 'Elige una hora',
			selectMultiple: 'Selecciona varias',
			other: 'Otro',
			pleaseSpecify: 'Por favor, especifica...',
			mustBeAtLeast: 'Debe ser al menos',
			mustBeAtMost: 'Debe ser como máximo',
			pleaseProvideValue: 'Por favor, introduce un valor'
		},
		FR: {
			pickValue: 'Choisissez une valeur',
			chooseOne: 'Choisissez une option',
			enterNumber: 'Entrez un nombre',
			pickDate: 'Choisissez une date',
			pickDateTime: 'Choisissez une date et une heure',
			pickTime: 'Choisissez une heure',
			selectMultiple: 'Sélectionnez plusieurs',
			other: 'Autre',
			pleaseSpecify: 'Veuillez préciser...',
			mustBeAtLeast: 'Doit être au moins',
			mustBeAtMost: 'Doit être au plus',
			pleaseProvideValue: 'Veuillez fournir une valeur'
		}
	};

	let t = $derived(TRANSLATIONS[lang] ?? TRANSLATIONS.EN);

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
			const parts = answer
				.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean);
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
		if (surveyItem.type === 'radio' || surveyItem.type === 'likert') return radioValue === value;
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
		onAnswer?.(answer.join(', '));
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

<div class="w-full max-w-full min-w-60">
	<fieldset
		class="flex flex-wrap gap-1.5 rounded-2xl border border-gray-100 bg-gray-200 p-4 sm:gap-2
            {['radio', 'checkbox'].includes(surveyItem.type) ? 'flex-col' : ''}
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
					list="slider-ticks"
				/>
				{#if sliderTicks.length <= 20}
					<datalist id="slider-ticks">
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
					list="tickmarks"
				/>

				<datalist id="tickmarks">
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
			<div class="flex w-full items-stretch justify-start pb-1">
				{#each likertOptions as opt, i (i)}
					<label
						class="flex flex-1 basis-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-xs font-medium break-words text-gray-700 transition-all
                  {disabled && !readonly
							? 'cursor-not-allowed opacity-60 grayscale'
							: disabled
								? 'cursor-default'
								: 'cursor-pointer hover:border-primary/50 hover:bg-gray-300'}"
					>
						<input
							type="radio"
							name={groupName}
							value={opt}
							checked={isChecked(opt)}
							onchange={() => toggleOption(opt)}
							disabled={disabled && !readonly}
							class="h-4 w-4 border-gray-300 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary disabled:text-gray-400"
						/>
						<span>{opt}</span>
					</label>
				{/each}
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
					<div class="w-full px-1">
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

	{#if !disabled && !readonly}
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
