<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		// Tailwind class for the accent stripe, e.g. 'border-l-sky-500'.
		borderColor: string;
		expanded?: boolean;
		removeTitle: string;
		onremove: () => void;
		// Left-hand content of the header row (icon + title/subtitle). The chevron
		// is appended automatically.
		header: Snippet;
		children: Snippet;
	}

	let {
		borderColor,
		expanded = $bindable(false),
		removeTitle,
		onremove,
		header,
		children
	}: Props = $props();
</script>

<div class="w-full rounded-md border border-l-4 border-gray-200 {borderColor} bg-gray-50 text-sm">
	<button
		class="flex w-full cursor-pointer items-center gap-3 p-2"
		onclick={() => (expanded = !expanded)}
	>
		{@render header()}
		<i
			class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200"
			class:rotate-180={expanded}
		></i>
	</button>
	{#if expanded}
		<div transition:slide={{ duration: 200 }} class="relative border-t border-gray-200 p-3">
			<button
				class="absolute top-2 right-2 cursor-pointer p-1 text-gray-400 hover:text-red-500"
				title={removeTitle}
				onclick={onremove}
			>
				<i class="fa-solid fa-trash text-sm"></i>
			</button>
			{@render children()}
		</div>
	{/if}
</div>
