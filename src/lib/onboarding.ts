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
 * Inject a "Don't show tours again" link into a driver.js popover footer, where
 * CSS (see app.css) places it in the bottom-right corner. Clicking it disables
 * all onboarding tours globally and closes the current one. Wire it up through
 * the tour's `onPopoverRender` hook, passing the same `tour` instance.
 */
export function addSkipOnboardingButton(popover: PopoverDOM, tour: Driver): void {
	// driver.js reuses the popover DOM across steps; don't add the button twice.
	const host = popover.footer ?? popover.wrapper;
	if (host.querySelector('.onboarding-skip-btn')) return;

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
	button.style.padding = '0';
	button.addEventListener('click', () => {
		disableOnboarding();
		tour.destroy();
	});

	host.appendChild(button);
}
