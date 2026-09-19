import { flushSync } from 'svelte';

import { mountAllLazy } from '$lib/components/LazyMount.svelte';

/**
 * Whether the document is currently being rendered for print.
 *
 * Print is one paint of the whole page with no reader to scroll it, so
 * everything the screen defers has to be opened before the snapshot is taken:
 * a collapsed option list, a clamped section description, a chart still
 * waiting its turn in the mount queue. CSS reaches the first two and nothing
 * reaches the third, so all three are driven from this flag instead.
 *
 * `beforeprint` is the only moment that can happen, and the browser takes the
 * snapshot as soon as the handler returns -- hence the `flushSync`, which is
 * what makes the reopened DOM part of the printed document rather than of the
 * frame after it.
 */
let active = $state(false);

export const printing = {
	get active() {
		return active;
	}
};

/**
 * Wires the print listeners, returning the teardown. Call from an `$effect` in
 * the route that is meant to be printed.
 */
export function watchPrinting() {
	const before = () => {
		if (active) return;
		active = true;
		// Whatever is still behind a placeholder has no chance to mount on its
		// own: the queue drains on idle callbacks that print does not wait for.
		mountAllLazy();
		flushSync();
	};

	const after = () => {
		active = false;
	};

	window.addEventListener('beforeprint', before);
	window.addEventListener('afterprint', after);

	// Safari fires neither event; the media query flipping is the only notice
	// it gives. Harmless where both exist, since `before` is idempotent.
	const media = window.matchMedia('print');
	const onChange = (event: MediaQueryListEvent) => (event.matches ? before() : after());
	media.addEventListener('change', onChange);

	return () => {
		window.removeEventListener('beforeprint', before);
		window.removeEventListener('afterprint', after);
		media.removeEventListener('change', onChange);
	};
}
