import type { Driver, DriveStep, PopoverDOM } from 'driver.js';

const DISABLED_KEY = 'onboarding-disabled';

// Per-tour "already seen" guards follow the `<page>-onboarded` naming
// convention (e.g. `dashboard-onboarded`). Re-enabling clears every key that
// matches, so new tours are covered without maintaining a hardcoded list.
const ONBOARDED_KEY_SUFFIX = '-onboarded';

/**
 * A tour step with a stable id, so a later visit can tell which steps are new.
 * Give a step a new id (e.g. `language-v2`) when its content changes enough
 * that returning users should see it again. A step that only works after the
 * one before it (say, a panel the previous step opens) must change id with it.
 */
export type TourStep = DriveStep & { id: string };

/**
 * The step ids a tour's stored guard says were seen: none when the user never
 * took the tour (`null`), every step in `legacyIds` when they took it before
 * steps had ids (`'true'`), and otherwise the JSON array of ids stored.
 */
export function seenStepIds(stored: string | null, legacyIds: readonly string[]): string[] {
	if (stored === null) return [];
	if (stored === 'true') return [...legacyIds];
	try {
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * The steps to drive on this visit of `tour`, which are then marked seen.
 * The first visit gets the whole tour; later ones only the steps added or
 * reworded since, behind a "What's new" intro. Empty when tours are turned
 * off or nothing is new.
 */
export function tourSteps(
	tour: string,
	steps: readonly TourStep[],
	legacyIds: readonly string[]
): DriveStep[] {
	if (typeof localStorage === 'undefined' || isOnboardingDisabled()) return [];
	const key = tour + ONBOARDED_KEY_SUFFIX;
	const seen = seenStepIds(localStorage.getItem(key), legacyIds);
	const unseen = steps.filter((step) => !seen.includes(step.id));
	if (unseen.length === 0) return [];

	// Keep the ids of steps not in this tour too: a step left out for now
	// (behind a flag, say) should not come back as new later.
	const ids = new Set([...seen, ...steps.map((step) => step.id)]);
	localStorage.setItem(key, JSON.stringify([...ids]));

	if (unseen.length === steps.length) return [...steps];
	return [
		{
			popover: {
				title: "What's new",
				description: 'A few things have changed here since your last tour.'
			}
		},
		...unseen
	];
}

/** Whether the user has opted out of all onboarding tours. */
export function isOnboardingDisabled(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(DISABLED_KEY) === 'true';
}

/** Opt out of every onboarding tour from now on. */
export function disableOnboarding(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(DISABLED_KEY, 'true');
}

/** Re-enable all onboarding tours and reset every page-specific "seen" guard. */
export function enableOnboarding(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(DISABLED_KEY);
	// Collect first, then remove, since removal mutates the localStorage index.
	const guardKeys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.endsWith(ONBOARDED_KEY_SUFFIX)) guardKeys.push(key);
	}
	for (const key of guardKeys) localStorage.removeItem(key);
}

/**
 * Inject a "Don't show tours again" link into a driver.js popover. It's appended
 * to the popover box and floated just below it via CSS (see app.css).
 * Clicking it disables all onboarding tours globally and closes the current one.
 * Wire it up through the tour's `onPopoverRender` hook, passing the same `tour`.
 */
export function addSkipOnboardingButton(popover: PopoverDOM, tour: Driver): void {
	// driver.js reuses the popover DOM across steps; don't add the button twice.
	if (popover.wrapper.querySelector('.onboarding-skip-btn')) return;

	const button = document.createElement('button');
	button.type = 'button';
	button.innerText = "Don't show any guided tours";
	// NOTE: avoid a class containing "driver-popover" — driver.js swallows such
	// clicks in its capture-phase listener, so our handler would never fire.
	button.className = 'onboarding-skip-btn';
	button.addEventListener('click', () => {
		disableOnboarding();
		tour.destroy();
	});

	// Anchored to the popover box; positioned/styled in app.css.
	popover.wrapper.appendChild(button);
}
