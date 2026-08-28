<script lang="ts">
	let { text, lines = 3 }: { text: string; lines?: number } = $props();

	let paragraph = $state<HTMLParagraphElement | null>(null);
	let open = $state(false);

	// Whether the clamp is actually hiding anything. A character count was the
	// obvious stand-in and the wrong one: a description can run well past any
	// threshold and still fit its lines at this width, which left a "Show more"
	// that revealed nothing. Only the layout knows, so ask the layout.
	let overflowing = $state(false);

	$effect(() => {
		const element = paragraph;
		if (!element) return;

		// Re-measure when the text itself changes, not only when the box resizes.
		void text;
		void lines;

		const measure = () => {
			// Meaningful only while clamped -- expanded, the element is its own
			// full height and nothing ever looks clipped. The last clamped
			// verdict stands, which is what keeps "Show less" on screen.
			if (open) return;
			overflowing = element.scrollHeight > element.clientHeight + 1;
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});
</script>

<p
	bind:this={paragraph}
	class="mt-1 text-xs text-pretty text-gray-500"
	style={open
		? undefined
		: `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden`}
>
	{text}
</p>
{#if overflowing}
	<button
		type="button"
		onclick={() => (open = !open)}
		class="mt-1 text-xs font-medium text-primary hover:underline"
	>
		{open ? 'Show less' : 'Show more'}
	</button>
{/if}
