<script lang="ts">
	import { untrack } from 'svelte';

	let {
		value,
		onChange,
		placeholder = 'Search...',
		delay = 200,
		class: className = ''
	}: {
		value: string;
		onChange: (value: string) => void;
		placeholder?: string;
		delay?: number;
		class?: string;
	} = $props();

	// The input keeps its own text so typing stays responsive; the caller is only
	// told about the change once the user pauses.
	let text = $state(untrack(() => value));
	/** The value this component last sent, or is about to send once the timer fires. */
	let pending = untrack(() => value);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function emit(next: string) {
		pending = next;
		onChange(next);
	}

	function schedule(next: string) {
		pending = next;
		clearTimeout(timer);
		timer = setTimeout(() => emit(next), delay);
	}

	function clear() {
		clearTimeout(timer);
		text = '';
		emit('');
	}

	$effect(() => {
		// Adopt resets that come from outside (e.g. a "Clear filters" button)
		// without clobbering what the user is currently typing. Comparing against
		// `pending` rather than the last emitted value also cancels a debounce
		// that is still in flight, which would otherwise fire after the reset and
		// quietly undo it.
		if (value !== pending) {
			clearTimeout(timer);
			pending = value;
			text = value;
		}
	});

	$effect(() => () => clearTimeout(timer));
</script>

<div class="relative {className}">
	<i
		class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
	></i>
	<input
		type="search"
		{placeholder}
		bind:value={text}
		oninput={() => schedule(text)}
		class="w-full rounded-md border border-gray-300 py-1.5 pr-8 pl-9 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
	/>
	{#if text}
		<button
			type="button"
			class="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
			onclick={clear}
			title="Clear search"
			aria-label="Clear search"
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	{/if}
</div>
