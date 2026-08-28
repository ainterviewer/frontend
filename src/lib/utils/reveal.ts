import type { Attachment } from 'svelte/attachments';

/**
 * Marks an element `data-revealed` the first time it reaches the viewport, so
 * CSS can play an entry animation for content the reader has actually got to.
 *
 * The report renders every card up front, so animating on mount would run
 * hundreds of animations at load for bars nobody is looking at yet, and they
 * would all be over before they were scrolled to. One observer per card is
 * cheap; the animation it gates is a transform, which the compositor handles
 * without troubling the main thread during a scroll.
 */
export function reveal(): Attachment<HTMLElement> {
	return (node) => {
		// Without an observer there is nothing to wait for, so reveal rather
		// than leaving the content in its pre-animation state forever.
		if (typeof IntersectionObserver === 'undefined') {
			node.dataset.revealed = '';
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				// One-shot: scrolling back over a card should not replay it.
				observer.disconnect();
				node.dataset.revealed = '';
			},
			// A card is taller than the animation is long, so firing on its first
			// pixel would have the bars near its foot finished before they were
			// scrolled to. Pulling the bottom edge up holds the reveal back to
			// roughly when the card is being read. Expressed as a margin rather
			// than a `threshold`, which an element taller than the viewport can
			// never reach.
			{ rootMargin: '0px 0px -8% 0px' }
		);
		observer.observe(node);

		return () => observer.disconnect();
	};
}
