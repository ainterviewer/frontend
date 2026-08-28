<script lang="ts" module>
	// Charts are expensive to instantiate, and what actually blocks the main
	// thread is mounting several of them in the same frame. Everything that
	// becomes visible at once -- which is most of a screenful, since one
	// observer callback carries every entry that crossed the threshold --
	// therefore queues here and is let through one animation frame at a time,
	// so the browser gets to paint and handle input between two charts
	// appearing.
	//
	// The queue is module-level on purpose: the budget being shared out is the
	// frame, so it has to be shared across every instance on the page.
	const queue: (() => void)[] = [];
	let draining = false;

	function drain() {
		queue.shift()?.();
		if (queue.length > 0) {
			requestAnimationFrame(drain);
		} else {
			draining = false;
		}
	}

	function enqueue(mount: () => void) {
		queue.push(mount);
		if (draining) return;
		draining = true;
		requestAnimationFrame(drain);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		placeholder,
		rootMargin = '600px',
		class: className = ''
	}: {
		children: Snippet;
		/** Drawn until `children` is mounted. */
		placeholder?: Snippet;
		/** How far ahead of the viewport to start mounting. */
		rootMargin?: string;
		/**
		 * Put the height the mounted content will take here rather than on the
		 * content itself: an unmounted region that collapses to nothing sits in
		 * the viewport no matter how far down the page it belongs, which would
		 * mount every instance at once and defeat the whole arrangement.
		 */
		class?: string;
	} = $props();

	let mounted = $state(false);

	function whenVisible(node: HTMLElement) {
		if (mounted) return;

		// Nothing to defer against without an observer, so mount rather than
		// leaving the placeholder up forever.
		if (typeof IntersectionObserver === 'undefined') {
			mounted = true;
			return;
		}

		// Navigating away with instances still queued must not mount them into
		// components that are already gone.
		let cancelled = false;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				// One-shot: past this point the content stays mounted, so
				// scrolling back and forth does not pay the cost again.
				observer.disconnect();
				enqueue(() => {
					if (!cancelled) mounted = true;
				});
			},
			{ rootMargin }
		);
		observer.observe(node);

		return () => {
			cancelled = true;
			observer.disconnect();
		};
	}
</script>

<div {@attach whenVisible} class={className}>
	{#if mounted}
		{@render children()}
	{:else}
		{@render placeholder?.()}
	{/if}
</div>
