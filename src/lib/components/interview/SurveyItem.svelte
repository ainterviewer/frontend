<script lang="ts">
	import type { SurveyItem } from '$lib/api';

	let {
		type = 'checkbox',
		options = [],
		required = false,
		min = null,
		max = null,
		step = null,
		with_other = false,
		onAnswer
	} = $props<SurveyItem & { onAnswer?: (value: unknown) => void }>();

	let sliderValue = $state(0);
	// We can use a set for multi-select (checkbox), single value for radio
	let selectedValues = $state(new Set<string>());

	// For radio, we can just use a string variable.
	let radioValue = $state('');

	let numberValue = $state<number | null>(null);
	let dateValue = $state('');

	let otherSelected = $state(false);
	let otherText = $state('');

	let disabled = $state(false);

	let normalizedOptions = $derived(
		options.map((opt: any) => {
			if (typeof opt === 'object') {
				return { label: opt.label, value: opt.value || opt.label, tip: opt.tip };
			}
			return { label: String(opt), value: String(opt), tip: '' };
		})
	);

	function toggleOption(value: string) {
		if (disabled) return;

		if (type === 'radio') {
			radioValue = value;
			otherSelected = false;
		} else {
			if (selectedValues.has(value)) {
				selectedValues.delete(value);
			} else {
				selectedValues.add(value);
			}
			// Trigger reactivity explicitly if needed (Set is not deeply reactive in Svelte 5 unless using specific methods or reassignment)
			selectedValues = new Set(selectedValues);
		}
	}

	function isChecked(value: string) {
		if (type === 'radio') return radioValue === value;
		return selectedValues.has(value);
	}

	function selectOther() {
		if (disabled) return;
		if (type === 'radio') {
			radioValue = '';
			otherSelected = true;
		} else {
			otherSelected = !otherSelected;
		}
	}

	function sendAnswer() {
		if (disabled) return;

		let answer: string[] = [];
		if (type === 'slider') {
			// For slider, the option at the index is the answer
			const selectedOption = normalizedOptions[sliderValue];
			if (selectedOption) {
				answer = [selectedOption.value];
			}
		} else if (type === 'radio') {
			if (otherSelected && otherText) answer = [otherText];
			else if (radioValue) answer = [radioValue];
		} else if (type === 'number') {
			if (numberValue !== null) answer = [String(numberValue)];
		} else if (type === 'date') {
			if (dateValue) answer = [dateValue];
		} else {
			answer = Array.from(selectedValues);
			if (otherSelected && otherText) answer.push(otherText);
		}

		if (required && answer.length === 0) {
			alert('Please provide a value');
			return;
		}

		disabled = true;
		onAnswer(answer.join(', '));
	}
</script>

<div class="mt-2 w-full max-w-full min-w-60">
	<fieldset
		class="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-200 p-4
            {['radio', 'checkbox'].includes(type) ? 'flex-col' : ''}"
	>
		<legend
			class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
		>
			{type === 'slider'
				? 'Pick a value'
				: type === 'radio'
					? 'Choose one'
					: type === 'number'
						? 'Enter a number'
						: type === 'date'
							? 'Pick a date'
							: 'Select multiple'}
		</legend>

		{#if type === 'slider'}
			<div class="w-full px-2">
				<input
					type="range"
					min="0"
					max={normalizedOptions.length - 1}
					step="1"
					bind:value={sliderValue}
					{disabled}
					class="my-6 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
					list="tickmarks"
				/>

				<datalist id="tickmarks">
					{#each normalizedOptions as opt, i}
						<option value={i} label={opt.label}></option>
					{/each}
				</datalist>
				<div class="flex justify-between gap-4 text-xs font-medium text-gray-600">
					{#each normalizedOptions as opt, i}
						<span class="flex-1 text-center first:text-left last:text-right">
							{opt.label}
						</span>
					{/each}
				</div>
			</div>
		{:else if type === 'number'}
			<div class="w-full px-2">
				<input
					type="number"
					bind:value={numberValue}
					min={min ?? undefined}
					max={max ?? undefined}
					step={step ?? undefined}
					{disabled}
					class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
					placeholder="Enter a number{min != null && max != null
						? ` (${min}–${max})`
						: min != null
							? ` (min ${min})`
							: max != null
								? ` (max ${max})`
								: ''}"
				/>
			</div>
		{:else if type === 'date'}
			<div class="w-full px-2">
				<input
					type="date"
					bind:value={dateValue}
					{disabled}
					class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
				/>
			</div>
		{:else}
			{#each normalizedOptions as opt, i (i)}
				<div class="relative max-w-full min-w-min">
					<label
						class="flex w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all
                   hover:border-primary/50 hover:bg-gray-200
                   {isChecked(opt.value)
							? 'border-primary bg-primary/10 text-dark ring-1 ring-primary'
							: ''}
                  {disabled ? 'cursor-not-allowed opacity-60 grayscale' : ''}"
						title={opt.tip}
					>
						<input
							{type}
							name="survey-option"
							value={opt.value}
							checked={isChecked(opt.value)}
							onchange={() => toggleOption(opt.value)}
							{disabled}
							class="mr-3 h-4 w-4 border-gray-300 text-primary focus:ring-primary disabled:text-gray-400"
						/>
						{opt.label}
						{#if opt.tip}
							<i class="fa-solid fa-circle-question ml-2 text-gray-400"></i>
						{/if}
					</label>
				</div>
			{/each}
			{#if with_other}
				<div class="relative max-w-full min-w-min">
					<label
						class="flex w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all
                   hover:border-primary/50 hover:bg-gray-200
                   {otherSelected
							? 'border-primary bg-primary/10 text-dark ring-1 ring-primary'
							: ''}
                  {disabled ? 'cursor-not-allowed opacity-60 grayscale' : ''}"
					>
						<input
							{type}
							name="survey-option"
							value="__other__"
							checked={otherSelected}
							onchange={selectOther}
							{disabled}
							class="mr-3 h-4 w-4 border-gray-300 text-primary focus:ring-primary disabled:text-gray-400"
						/>
						Other
					</label>
				</div>
				{#if otherSelected}
					<div class="w-full px-1">
						<input
							type="text"
							bind:value={otherText}
							{disabled}
							class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
							placeholder="Please specify..."
						/>
					</div>
				{/if}
			{/if}
		{/if}
	</fieldset>

	{#if !disabled}
		<div class="mt-2 flex justify-end">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-gray-500 shadow-md transition-all hover:scale-110 hover:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-98"
				onclick={sendAnswer}
				aria-label="Submit answer"
			>
				<i class="fa-solid fa-arrow-right"></i>
			</button>
		</div>
	{/if}
</div>
