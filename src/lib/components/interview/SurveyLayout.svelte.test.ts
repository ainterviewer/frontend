/**
 * A layout audit of every survey item type, as the respondent sees it.
 *
 * Each case renders in the real answer bubble (`MessageBubble`) inside the
 * chat column's own classes, at a computer's width, a narrow window's and a
 * phone's, and in the guide editor's phone preview. Each checks that
 * nothing sticks out of the bubble or scrolls sideways, that no text runs
 * into other text, and that no word is split over two lines unless it is
 * long enough to hyphenate (seven letters or more).
 *
 * A failure names the case and what went wrong. To look at the layouts
 * yourself, `just survey-layout` saves a screenshot of every case under
 * `survey-shots/`, plus a contact sheet per screen if ImageMagick is
 * installed. Add a case here for any new item type or layout rule.
 */
import '/src/app.css';

import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import MessageBubble from './MessageBubble.svelte';
import SurveyItem from './SurveyItem.svelte';
import type { SurveyItemUnion } from './types';

const SHOTS = Boolean(import.meta.env.VITE_SURVEY_SHOTS);

const agree = [
	'Meget uenig',
	'Overvejende uenig',
	'Hverken/eller',
	'Overvejende enig',
	'Meget enig'
];
const worry = [
	'1. Slet ikke bekymret',
	...Array.from({ length: 8 }, (_, i) => String(i + 2)),
	'10. Meget bekymret'
];
const dontKnow = [
	'Meget uenig',
	'Delvis uenig',
	'Hverken enig eller uenig',
	'Delvis enig',
	'Meget enig',
	'Ved ikke'
];
const sentences = [
	'Jeg handler næsten altid ind i det lokale supermarked',
	'Jeg bestiller det meste online og får det leveret',
	'Det varierer meget fra uge til uge',
	'Ved ikke'
];
const many = Array.from({ length: 12 }, (_, i) => `Mulighed ${i + 1}`);
const numbers = Array.from({ length: 11 }, (_, i) => String(i));
const blank = [
	'Meget uenig',
	...Array(4).fill(''),
	'Hverken/eller',
	...Array(4).fill(''),
	'Overvejende uenig'
];
const rows = (n: number, text = 'Udsagn') =>
	Array.from({ length: n }, (_, i) => ({ id: `r${i}`, text: `${text} ${i + 1}` }));
const longRows = [
	{
		id: 'a',
		text: 'Jeg er bekymret for, at min bolig bliver ramt af stormflod eller oversvømmelse fra havet'
	},
	{ id: 'b', text: 'Jeg er bekymret for, hvad stigende havniveau vil betyde for mit lokalområde' }
];

const CASES = {
	'radio-few': { type: 'radio', options: ['Ja', 'Nej'] },
	'radio-many': { type: 'radio', options: many },
	'radio-sentences-other': { type: 'radio', options: sentences, with_other: true },
	'checkbox-few': { type: 'checkbox', options: ['Kaffe', 'Te'] },
	'checkbox-many-other': { type: 'checkbox', options: many, with_other: true },
	'checkbox-sentences': { type: 'checkbox', options: sentences },
	'likert-3': { type: 'likert', ui: 'radio', options: ['Nej', 'Måske', 'Ja'] },
	'likert-5-agree': { type: 'likert', ui: 'radio', options: agree },
	'likert-6-dont-know': { type: 'likert', ui: 'radio', options: dontKnow },
	'likert-7-numbered': {
		type: 'likert',
		ui: 'radio',
		options: ['1 Aldrig', '2', '3', '4', '5', '6', '7 Altid']
	},
	'likert-8-short': {
		type: 'likert',
		ui: 'radio',
		options: ['Nej', 'Lidt', 'Noget', 'Meget', 'Helt', 'Ved ikke', 'Vil ikke', 'Andet']
	},
	'likert-10-worry': { type: 'likert', ui: 'radio', options: worry },
	'likert-11-blank': { type: 'likert', ui: 'radio', options: blank },
	'likert-5-bare-numbers': {
		type: 'likert',
		ui: 'radio',
		options: ['Disagree', '2', '3', '4', 'Agree']
	},
	'likert-11-numbers': { type: 'likert', ui: 'radio', options: numbers },
	'likert-5-long-words': {
		type: 'likert',
		ui: 'radio',
		options: ['Uoverensstemmende', 'Lidt', 'Midt', 'Noget', 'Sammenfaldende']
	},
	'likert-slider-5': { type: 'likert', ui: 'slider', options: agree },
	'likert-slider-11': { type: 'likert', ui: 'slider', options: numbers },
	'grid-3-short': { type: 'likert_grid', rows: rows(2), options: ['Nej', 'Måske', 'Ja'] },
	'grid-5-agree': {
		type: 'likert_grid',
		rows: rows(3),
		options: ['Meget uenig', 'uenig', 'hverken/eller', 'enig', 'Meget enig']
	},
	'grid-5-long-rows': { type: 'likert_grid', rows: longRows, options: agree },
	'grid-6-dont-know': { type: 'likert_grid', rows: longRows, options: dontKnow },
	'grid-10-worry': { type: 'likert_grid', rows: rows(2), options: worry },
	'grid-11-blank': { type: 'likert_grid', rows: rows(2), options: blank },
	'grid-many-rows': {
		type: 'likert_grid',
		rows: rows(10, 'Et ret langt udsagn nummer'),
		options: ['Nej', 'Lidt', 'Meget']
	},
	'slider-labels': {
		type: 'slider',
		min: 0,
		max: 100,
		step: 1,
		min_label: 'Slet ikke tilfreds',
		max_label: 'Fuldstændig tilfreds'
	},
	'slider-plain': { type: 'slider', min: 1, max: 5, step: 1 },
	number: { type: 'number', min: 0, max: 120 },
	date: { type: 'date' },
	datetime: { type: 'datetime' },
	time: { type: 'time' }
} as Record<string, SurveyItemUnion>;

const SCREENS = { desktop: [1280, 900], narrow: [700, 900], phone: [375, 800] } as const;

/** A word this long may hyphenate (`[hyphenate-limit-chars:7_3_3]`). */
const HYPHENATES = 7;

/** The visible text nodes under `root`, with the boxes of their lines. */
function texts(root: Element) {
	const found: { text: Text; boxes: DOMRect[] }[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		const text = walker.currentNode as Text;
		if (!text.data.trim() || text.parentElement!.closest('.sr-only, option, datalist')) continue;
		const range = document.createRange();
		range.selectNodeContents(text);
		const boxes = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
		if (boxes.length) found.push({ text, boxes });
	}
	return found;
}

/** What is wrong with the layout under `bubble`, as readable lines. */
function audit(bubble: HTMLElement): string[] {
	const problems: string[] = [];
	const frame = bubble.getBoundingClientRect();
	if (frame.right > window.innerWidth + 0.5) problems.push('the bubble runs off the screen');

	for (const el of bubble.querySelectorAll<HTMLElement>('*')) {
		if (el.closest('.sr-only')) continue;
		const box = el.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) continue;
		const name = `<${el.tagName.toLowerCase()}>${el.textContent?.trim().slice(0, 30) ?? ''}`;
		if (box.right > frame.right + 1 || box.left < frame.left - 1)
			problems.push(`sticks out of the bubble: ${name}`);
		if (/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
			problems.push(`scrolls sideways: ${name}`);
	}

	const found = texts(bubble);
	for (let i = 0; i < found.length; i++)
		for (let j = i + 1; j < found.length; j++)
			for (const a of found[i].boxes)
				for (const b of found[j].boxes) {
					const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
					const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
					if (x > 1 && y > 1)
						problems.push(
							`text overlaps: "${found[i].text.data.trim()}" and "${found[j].text.data.trim()}"`
						);
				}

	// A break after a slash is allowed ("Hverken/ eller"), so the slash ends a word.
	for (const { text } of found)
		for (const match of text.data.matchAll(/[^\s/]+\/?/g)) {
			const word = match[0].replace(/\/$/, '');
			if (word.length >= HYPHENATES) continue;
			const range = document.createRange();
			range.setStart(text, match.index);
			range.setEnd(text, match.index + match[0].length);
			const lines = new Set(
				[...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => Math.round(r.top))
			);
			if (lines.size > 1) problems.push(`a short word is split: "${word}"`);
		}

	return [...new Set(problems)];
}

beforeAll(async () => {
	await document.fonts.load('500 12px "Inter Variable"');
	await document.fonts.load('400 14px "Inter Variable"');
});

describe.each(Object.entries(SCREENS))('on a %s screen', (screenName, [width, height]) => {
	test.each(Object.keys(CASES))('%s', async (name) => {
		await page.viewport(width, height);
		// The chat column, as `InterviewChat` lays it out.
		const column = document.createElement('div');
		column.className = 'flex flex-col items-center bg-white';
		const messages = document.createElement('div');
		messages.className = 'w-full px-2.5 py-2 sm:w-[90%] sm:max-w-175 sm:min-w-125 sm:px-0';
		column.append(messages);
		document.body.append(column);

		const screen = await render(MessageBubble, {
			target: messages,
			props: { interviewer: false, surveyItem: CASES[name], readonly: false, lang: 'DA' }
		});
		const bubble = messages.querySelector<HTMLElement>('.inline-block')!;
		try {
			if (SHOTS)
				await page
					.elementLocator(column)
					.screenshot({ path: `../../../../survey-shots/${screenName}--${name}.png` });
			expect(audit(bubble)).toEqual([]);
		} finally {
			screen.unmount();
			column.remove();
		}
	});
});

describe("in the guide editor's phone preview", () => {
	test.each(Object.keys(CASES))('%s', async (name) => {
		await page.viewport(1280, 900);
		// Sized as `QuestionSurveyPanel` sizes its preview of a phone.
		const pane = document.createElement('div');
		pane.className = 'w-120 bg-white p-2';
		const preview = document.createElement('div');
		preview.className = 'ml-auto w-fit max-w-76 text-sm break-words hyphens-auto';
		preview.lang = 'da';
		pane.append(preview);
		document.body.append(pane);

		const screen = await render(SurveyItem, {
			target: preview,
			props: { ...CASES[name], lang: 'DA', preview: true, phone: true }
		});
		try {
			if (SHOTS)
				await page
					.elementLocator(pane)
					.screenshot({ path: `../../../../survey-shots/preview--${name}.png` });
			expect(audit(preview)).toEqual([]);
		} finally {
			screen.unmount();
			pane.remove();
		}
	});
});
