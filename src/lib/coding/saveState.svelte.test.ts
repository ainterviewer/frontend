import '/src/app.css';

import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SaveState from './SaveState.svelte';
import type { Codebook } from './store.svelte';

const book = (saving: boolean) =>
	({ status: 'ready', error: null, saving, dirty: false, flush: () => {} }) as unknown as Codebook;

/**
 * Font Awesome is loaded from a CDN by `app.html`, so its glyphs have no size
 * here. The heights are stood in for instead -- what matters is whether the
 * indicator's position depends on them, and the real icons differ.
 */
function boxes(saving: boolean, wrapper: string) {
	document.body.innerHTML = '';
	const host = document.createElement('div');
	host.className = wrapper;
	document.body.append(host);
	render(SaveState, { book: book(saving) });
	host.append(document.body.querySelector('span')!);
	const icon = host.querySelector('i')!;
	icon.style.display = 'inline-block';
	icon.style.height = saving ? '16px' : '10px';
	const span = host.querySelector('span')!;
	return { top: span.getBoundingClientRect().top - host.getBoundingClientRect().top };
}

test('the indicator stays put when a save swaps its icon', () => {
	// In a plain block, which is the demanding case: an inline-level indicator
	// would be aligned by the icon's baseline and drop down the line as soon as
	// the taller glyph arrived.
	expect(boxes(true, '').top).toBeCloseTo(boxes(false, '').top, 1);
});
