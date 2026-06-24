import type { Driver, PopoverDOM } from 'driver.js';

const DISABLED_KEY = 'onboarding-disabled';

// Per-tour "already seen" guards follow the `<page>-onboarded` naming
// convention (e.g. `dashboard-onboarded`). Re-enabling clears every key that
// matches, so new tours are covered without maintaining a hardcoded list.
const ONBOARDED_KEY_SUFFIX = '-onboarded';

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
 * Inject a "Don't show tours again" link into a driver.js popover, on its own
 * row beneath the navigation buttons so it doesn't crowd the footer. Clicking it
 * disables all onboarding tours globally and closes the current one. Wire it up
 * through the tour's `onPopoverRender` hook, passing the same `tour` instance.
 */
export function addSkipOnboardingButton(popover: PopoverDOM, tour: Driver): void {
	// driver.js may reuse the popover wrapper across steps; don't add it twice.
	if (popover.wrapper.querySelector('.onboarding-skip-row')) return;

	const row = document.createElement('div');
	row.className = 'onboarding-skip-row';
	row.style.textAlign = 'center';
	row.style.paddingTop = '8px';

	const button = document.createElement('button');
	button.type = 'button';
	button.innerText = "Don't show any tours again";
	// NOTE: avoid a class containing "driver-popover" — driver.js swallows such
	// clicks in its capture-phase listener, so our handler would never fire.
	button.className = 'onboarding-skip-btn';
	// Render as a muted text link rather than a chunky driver button.
	button.style.background = 'transparent';
	button.style.border = 'none';
	button.style.textShadow = 'none';
	button.style.color = '#6b7280';
	button.style.fontSize = '12px';
	button.style.cursor = 'pointer';
	button.addEventListener('click', () => {
		disableOnboarding();
		tour.destroy();
	});

	row.appendChild(button);
	popover.wrapper.appendChild(row);
}
