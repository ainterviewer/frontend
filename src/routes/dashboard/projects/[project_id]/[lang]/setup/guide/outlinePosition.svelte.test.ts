import { afterEach, describe, expect, it } from 'vitest';

import {
	MARK_HASH_ENTRY,
	outlineEntryAt,
	outlineEntryOf,
	outlineEntryOfHash
} from './outlinePosition';

const IDS = ['framing', 'sections', 'section', 'question', 'outro'];

/**
 * A 300px scroller, its reading line 120px down: 200px blocks at 0, 200, 400
 * and 600, and a 50px `outro` at 800 that never reaches the line.
 */
function guide(): HTMLElement {
	const scroller = document.createElement('div');
	scroller.style.cssText = 'height: 300px; overflow: auto; position: relative;';
	for (const id of IDS) {
		const block = document.createElement('div');
		block.id = id;
		block.style.height = id === 'outro' ? '50px' : '200px';
		scroller.append(block);
	}
	document.body.append(scroller);
	return scroller;
}

afterEach(() => {
	document.body.replaceChildren();
	history.replaceState(null, '', location.pathname);
});

describe('outlineEntryAt', () => {
	it('is the first entry at the top', () => {
		expect(outlineEntryAt(guide(), IDS)).toBe('framing');
	});

	it('is the last entry whose top passed the reading line', () => {
		const scroller = guide();
		// The question's top 130px down: still below the line.
		scroller.scrollTop = 470;
		expect(outlineEntryAt(scroller, IDS)).toBe('section');
		// 110px down: past it, with its section scrolled out above.
		scroller.scrollTop = 490;
		expect(outlineEntryAt(scroller, IDS)).toBe('question');
	});

	it('is the last entry in view at the bottom', () => {
		const scroller = guide();
		scroller.scrollTop = scroller.scrollHeight;
		expect(outlineEntryAt(scroller, IDS)).toBe('outro');
	});
});

describe('outlineEntryOf', () => {
	it('is the innermost entry an element is in', () => {
		const scroller = guide();
		const section = document.getElementById('section')!;
		const field = document.createElement('textarea');
		const question = document.createElement('div');
		question.id = 'nested';
		question.append(field);
		section.append(question);
		const ids = new Set([...IDS, 'nested']);
		expect(outlineEntryOf(field, ids, scroller)).toBe('nested');
		expect(outlineEntryOf(section, ids, scroller)).toBe('section');
		expect(outlineEntryOf(scroller, ids, scroller)).toBeUndefined();
	});
});

describe('outlineEntryOfHash', () => {
	it('names an entry of the outline only', () => {
		expect(outlineEntryOfHash('#question', IDS)).toBe('question');
		expect(outlineEntryOfHash('#elsewhere', IDS)).toBeUndefined();
		expect(outlineEntryOfHash('', IDS)).toBeUndefined();
	});

	it('names none for a # that is not valid percent-encoding', () => {
		expect(outlineEntryOfHash('#%E0', IDS)).toBeUndefined();
	});
});

describe('MARK_HASH_ENTRY', () => {
	function outline() {
		const nav = document.createElement('nav');
		for (const id of IDS) {
			const link = document.createElement('a');
			link.href = `#${id}`;
			if (id === 'framing') link.setAttribute('aria-current', 'location');
			nav.append(link);
		}
		document.body.append(nav);
		const script = document.createElement('script');
		script.textContent = MARK_HASH_ENTRY;
		document.body.append(script);
		return nav;
	}

	const current = (nav: HTMLElement) =>
		[...nav.querySelectorAll('[aria-current="location"]')].map((a) => a.getAttribute('href'));

	it('marks the entry the hash names', () => {
		history.replaceState(null, '', '#question');
		expect(current(outline())).toEqual(['#question']);
	});

	it('leaves Framing marked without a hash, or for one no entry has', () => {
		expect(current(outline())).toEqual(['#framing']);
		document.body.replaceChildren();
		history.replaceState(null, '', '#elsewhere');
		expect(current(outline())).toEqual(['#framing']);
		document.body.replaceChildren();
		history.replaceState(null, '', '#%E0');
		expect(current(outline())).toEqual(['#framing']);
	});
});
