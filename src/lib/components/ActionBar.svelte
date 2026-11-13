<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children
	}: {
		/** Placement classes for the sticky wrapper, e.g. `mt-auto`. It sits at `z-20`, above in-page overlays such as the guide's add question/section bar. */
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="@container pointer-events-none sticky bottom-0 z-20 w-full {className}">
	<!-- The floating pill pinned to the foot of a page. Its contents can size off
	     the bar's own available width with `@3xl:` variants, not the viewport: the
	     page's side panel makes the viewport a poor proxy for the room left here.
	     A container cannot take its width from its content, so the wrapper spans
	     the full width and lets clicks through to the page; only the pill takes
	     them. The bar never wraps, so it stays one row at any width.
	     `data-action-bar` marks the pill: the guide scrolls elements out from
	     under it. A comment must not lead
	     this template: as a second root node it breaks hydration where the
	     component sits next to siblings. -->
	<div
		data-action-bar
		class="pointer-events-auto ml-auto flex w-fit max-w-full flex-nowrap items-center justify-end gap-2 rounded-full border border-gray-200 bg-white/90 p-2 shadow-lg backdrop-blur @3xl:gap-4 @3xl:p-4"
	>
		{@render children()}
	</div>
</div>
