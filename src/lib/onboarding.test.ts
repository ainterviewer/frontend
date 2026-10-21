import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { seenStepIds, type TourStep, tourSteps } from './onboarding';

const steps: TourStep[] = [
	{ id: 'intro', popover: { title: 'Intro' } },
	{ id: 'language-v2', popover: { title: 'Language' } },
	{ id: 'done', popover: { title: 'Done' } }
];
const legacy = ['intro', 'language', 'done'];

describe('seenStepIds', () => {
	it('reads each shape of the guard', () => {
		expect(seenStepIds(null, legacy)).toEqual([]);
		expect(seenStepIds('true', legacy)).toEqual(legacy);
		expect(seenStepIds('["intro",3]', legacy)).toEqual(['intro']);
		expect(seenStepIds('not json', legacy)).toEqual([]);
	});
});

describe('tourSteps', () => {
	let store: Map<string, string>;

	beforeEach(() => {
		store = new Map();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value)
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('shows the whole tour on a first visit, and nothing after', () => {
		expect(tourSteps('guide', steps, legacy)).toEqual(steps);
		expect(tourSteps('guide', steps, legacy)).toEqual([]);
	});

	it('shows only new steps to a user who took the tour before ids', () => {
		store.set('guide-onboarded', 'true');
		const shown = tourSteps('guide', steps, legacy);
		expect(shown.map((step) => step.popover?.title)).toEqual(["What's new", 'Language']);
		expect(JSON.parse(store.get('guide-onboarded')!)).toEqual([...legacy, 'language-v2']);
	});

	it('shows nothing when tours are turned off', () => {
		store.set('onboarding-disabled', 'true');
		expect(tourSteps('guide', steps, legacy)).toEqual([]);
	});
});
