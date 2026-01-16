<script lang="ts">
	let { type = 'checkbox', options = [], required = false, onAnswer } = $props();

	let sliderValue = $state(0);
	// We can use a set for multi-select (checkbox), single value for radio
	let selectedValues = $state(new Set<string>());

	// For radio, we can just use a string variable.
	let radioValue = $state('');

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
			if (radioValue) answer = [radioValue];
		} else {
			answer = Array.from(selectedValues);
		}

		if (required && answer.length === 0) {
			alert('Please select at least one option');
			return;
		}

		disabled = true;
		onAnswer(answer.join(', '));
	}
</script>

<div class="mt-2 w-full max-w-full">
	<fieldset
		class="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 {type ===
		'radio'
			? 'flex-col'
			: ''}"
	>
		<legend
			class="mx-auto rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 shadow-sm"
		>
			{type === 'slider' ? 'Pick a value' : type === 'radio' ? 'Choose one' : 'Select multiple'}
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
					class="my-6 w-full cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
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
		{:else}
			{#each normalizedOptions as opt}
				<div class="relative max-w-full min-w-min">
					<label
						class="
                            flex w-fit max-w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all
                            hover:border-blue-300 hover:bg-blue-50
                            {isChecked(opt.value)
							? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
							: ''}
                            {disabled ? 'cursor-not-allowed opacity-60 grayscale' : ''}
                        "
						title={opt.tip}
					>
						<input
							{type}
							name="survey-option"
							value={opt.value}
							checked={isChecked(opt.value)}
							onchange={() => toggleOption(opt.value)}
							{disabled}
							class="mr-3 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:text-gray-400"
						/>
						{opt.label}
						{#if opt.tip}
							<i class="fa-solid fa-circle-question ml-2 text-gray-400"></i>
						{/if}
					</label>
				</div>
			{/each}
		{/if}
	</fieldset>

	{#if !disabled}
		<div class="mt-4 flex justify-end">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
				onclick={sendAnswer}
				aria-label="Submit answer"
			>
				<i class="fa-solid fa-arrow-right"></i>
			</button>
		</div>
	{/if}
</div>
