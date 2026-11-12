<script lang="ts">
	import { dragState } from './dragState.svelte';

	// An "add here" control sitting in the gap above the item that follows it in
	// a `space-y-*` list. It takes no room of its own: the zero-height wrapper
	// drops the list's margin so the gap stays as it was, and the control is
	// laid over the gap, shown on hover or
	// keyboard focus. Only the gap itself and the pill are clickable: the pill
	// is a child of the button, so where it overflows the gap onto the items on
	// either side it still hovers and clicks, but their edges do not.
	let {
		label,
		gap,
		onclick
	}: {
		label: string;
		/** The list's gap in rem, to centre the control in it. */
		gap: number;
		onclick: () => void;
	} = $props();
</script>

{#if !dragState.draggingType}
	<div class="relative !mb-0 h-0 print:hidden">
		<button
			type="button"
			class="absolute inset-x-0 z-10 flex cursor-pointer items-center opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:hidden"
			style:top="-{gap}rem"
			style:height="{gap}rem"
			aria-label={label}
			{onclick}
		>
			<span class="h-0.5 flex-1 rounded bg-primary"></span>
			<span
				class="mx-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[0.8125rem] font-medium whitespace-nowrap text-white shadow-md hover:brightness-110"
			>
				<i class="fa-solid fa-plus"></i>
				{label}
			</span>
			<span class="h-0.5 flex-1 rounded bg-primary"></span>
		</button>
	</div>
{/if}
