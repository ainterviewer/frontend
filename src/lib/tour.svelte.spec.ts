import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs in the browser project (real driver.js and DOM), hence the .svelte.spec name.

type TourModule = typeof import('./tour');
let tour: TourModule;

function popoverTitle() {
	return document.querySelector('.driver-popover-title')?.textContent ?? null;
}

function config(title: string) {
	return { animate: false, steps: [{ element: '#target', popover: { title } }] };
}

const tick = () => new Promise((r) => setTimeout(r, 50));

function close() {
	(document.querySelector('.driver-popover-close-btn') as HTMLElement).click();
}

beforeEach(async () => {
	localStorage.clear();
	document.body.innerHTML = '<div id="target">target</div>';
	// Fresh queue state for every test.
	vi.resetModules();
	tour = await import('./tour');
});

afterEach(async () => {
	// Close tours until none is left, so a failing test can't leak one into the
	// next. Wait between closes: a queued tour starts a tick after the last one.
	for (let i = 0; i < 10; i++) {
		document.querySelector<HTMLElement>('.driver-popover-close-btn')?.click();
		await tick();
		if (!popoverTitle()) return;
	}
	throw new Error('A tour is still open after the test');
});

describe('startTourOnce', () => {
	it('plays tours registered in the same tick layout first, one at a time', async () => {
		// Svelte mounts the page before its layout.
		tour.startTourOnce('page', config('Page'));
		tour.startTourOnce('layout', config('Layout'));

		await expect.poll(popoverTitle).toBe('Layout');
		expect(localStorage.getItem('page-onboarded')).toBeNull();

		await close();
		await expect.poll(popoverTitle).toBe('Page');
		expect(localStorage.getItem('layout-onboarded')).toBe('true');
		expect(localStorage.getItem('page-onboarded')).toBe('true');
	});

	it('skips tours that were already seen or opted out of', async () => {
		localStorage.setItem('seen-onboarded', 'true');
		tour.startTourOnce('seen', config('Seen'));
		await tick();
		expect(popoverTitle()).toBeNull();

		localStorage.setItem('onboarding-disabled', 'true');
		tour.startTourOnce('fresh', config('Fresh'));
		await tick();
		expect(popoverTitle()).toBeNull();
	});

	it('drops a queued tour when its page unmounts, leaving it unseen', async () => {
		const stopPage = tour.startTourOnce('page', config('Page'));
		tour.startTourOnce('layout', config('Layout'));
		await expect.poll(popoverTitle).toBe('Layout');

		stopPage();
		await close();
		await tick();
		expect(popoverTitle()).toBeNull();
		expect(localStorage.getItem('page-onboarded')).toBeNull();
	});

	it('closes the active tour on unmount and moves on', async () => {
		tour.startTourOnce('page', config('Page'));
		const stopLayout = tour.startTourOnce('layout', config('Layout'));
		await expect.poll(popoverTitle).toBe('Layout');

		stopLayout();
		await expect.poll(popoverTitle).toBe('Page');
	});

	it('cancels every queued tour when the user opts out', async () => {
		tour.startTourOnce('page', config('Page'));
		tour.startTourOnce('layout', config('Layout'));
		await expect.poll(popoverTitle).toBe('Layout');

		(document.querySelector('.onboarding-skip-btn') as HTMLElement).click();
		await tick();
		expect(popoverTitle()).toBeNull();
		expect(localStorage.getItem('onboarding-disabled')).toBe('true');
		expect(localStorage.getItem('page-onboarded')).toBeNull();
	});

	it('applies a step’s own stage padding, then falls back to the tour’s', async () => {
		const padding: (number | undefined)[] = [];
		tour.startTourOnce('page', {
			animate: false,
			stagePadding: 3,
			onHighlighted: (_element, _step, { driver }) => {
				padding.push(driver.getConfig().stagePadding);
				setTimeout(() => driver.moveNext());
			},
			steps: [
				{ element: '#target', data: tour.SIDEBAR_STAGE, popover: { title: 'Flush' } },
				{ element: '#target', popover: { title: 'Default' } }
			]
		});
		await expect.poll(() => padding).toEqual([0, 3]);
	});

	it('still calls the caller’s own hooks', async () => {
		const onPopoverRender = vi.fn();
		const onDestroyed = vi.fn();
		tour.startTourOnce('page', { ...config('Page'), onPopoverRender, onDestroyed });
		await expect.poll(popoverTitle).toBe('Page');
		expect(onPopoverRender).toHaveBeenCalled();

		await close();
		await expect.poll(() => onDestroyed.mock.calls.length).toBe(1);
	});
});
