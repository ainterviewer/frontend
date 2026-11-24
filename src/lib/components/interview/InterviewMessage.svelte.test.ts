import '/src/app.css';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type Locator, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import InterviewMessage from './InterviewMessage.svelte';

const QUESTION = 'Which workspace do you use most?';

async function question(props: { onSkip?: () => void } = {}) {
	return render(InterviewMessage, {
		message: { type: 'received', message_id: 2, text: QUESTION },
		lang: 'en',
		skippable: true,
		onFeedback: () => {},
		onSkip: props.onSkip ?? (() => {}),
		onReport: () => {},
		reportLabel: 'Report this question',
		onSurveyAnswer: () => {}
	});
}

/** The row holding the flag and skip buttons. */
function controlsOf(screen: Awaited<ReturnType<typeof question>>): HTMLElement {
	return screen.getByRole('button', { name: 'Report this question' }).element().parentElement!;
}

/**
 * Whether the row is out of sight: transparent beside the bubble, or
 * `sr-only` under it. Read off the computed style, because both leave the
 * buttons in the layout tree, which is the point -- a `hidden` button cannot
 * be reached with Tab -- and so both count as "visible" to a locator.
 */
function concealed(row: HTMLElement): boolean {
	const style = getComputedStyle(row);
	return style.opacity === '0' || style.clipPath === 'inset(50%)';
}

/**
 * A click dispatched from script, not by the pointer: a real pointer would
 * also hover the element, and hover shows the controls by itself, so a test of
 * the tap would pass without the tap doing anything.
 */
function tap(locator: Locator) {
	(locator.element() as HTMLElement).click();
}

/** Pretend the device cannot hover, as a phone cannot. */
function touchDevice() {
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query: string) =>
			({
				matches: query === '(hover: none)',
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {}
			}) as unknown as MediaQueryList
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('question controls on a screen with room beside the bubble', () => {
	beforeEach(async () => {
		await page.viewport(1024, 768);
	});

	test('stay out of sight until the question is hovered', async () => {
		const screen = await question();
		const row = controlsOf(screen);
		expect(concealed(row)).toBe(true);

		await userEvent.hover(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(false);

		await userEvent.unhover(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(true);
	});

	test('come into view for a keyboard user tabbing to them', async () => {
		const screen = await question();
		const row = controlsOf(screen);

		await userEvent.keyboard('{Tab}');
		await expect
			.element(screen.getByRole('button', { name: 'Report this question' }))
			.toHaveFocus();
		await expect.poll(() => concealed(row)).toBe(false);
	});

	test('do not stay open after a click on a device that can hover', async () => {
		const screen = await question();
		const row = controlsOf(screen);

		tap(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(true);
	});
});

describe('question controls on a phone', () => {
	beforeEach(async () => {
		await page.viewport(375, 700);
		touchDevice();
	});

	test('a tap on the question shows them and a tap elsewhere hides them', async () => {
		const screen = await question();
		const row = controlsOf(screen);
		expect(concealed(row)).toBe(true);

		tap(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(false);

		document.body.click();
		await expect.poll(() => concealed(row)).toBe(true);
	});

	test('a second tap on the question hides them again', async () => {
		const screen = await question();
		const row = controlsOf(screen);

		tap(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(false);
		tap(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(true);
	});

	test('tapping skip skips the question and closes them', async () => {
		const onSkip = vi.fn();
		const screen = await question({ onSkip });
		const row = controlsOf(screen);

		tap(screen.getByText(QUESTION));
		await expect.poll(() => concealed(row)).toBe(false);

		tap(screen.getByRole('button', { name: 'Skip' }));
		expect(onSkip).toHaveBeenCalledOnce();
		await expect.poll(() => concealed(row)).toBe(true);
	});
});
