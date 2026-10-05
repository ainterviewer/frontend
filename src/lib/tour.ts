import { driver, type Config, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { addSkipOnboardingButton, isOnboardingDisabled, onboardedKey } from './onboarding';

// Kept apart from onboarding.ts so pages that only toggle the opt-out (e.g. the
// profile settings) don't pull driver.js into their bundle.

/**
 * Padding and corner radius of the highlight for a single step, set as the
 * step's `data`. driver.js itself only has tour-wide `stagePadding`/`stageRadius`.
 */
export type StageOverride = Pick<Config, 'stagePadding' | 'stageRadius'>;

/** Keeps the highlight flush with a sidebar item, which fills the sidebar's width. */
export const SIDEBAR_STAGE: StageOverride = { stagePadding: 0, stageRadius: 0 };

type PendingTour = { name: string; config: Config };

// Tours registered in the current tick, not yet queued (see startTourOnce).
let batch: PendingTour[] = [];
const queue: PendingTour[] = [];
let active: { pending: PendingTour; tour: Driver } | null = null;

/**
 * Show the onboarding tour `name` once per user, unless they opted out of all
 * tours. The "seen" guard is `<name>-onboarded` and is set when the tour starts.
 *
 * driver.js can only run one tour at a time, so tours are queued: e.g. a page
 * tour waits for the project sidebar tour on a first visit to that page.
 *
 * `config` is passed to driver.js as is, on top of `showProgress: true`; the
 * skip button is added automatically. Use the hooks' `opts.driver` to control
 * the tour. Return the result from `onMount` so leaving the page cancels or
 * closes the tour.
 */
export function startTourOnce(name: string, config: Config): () => void {
	if (isOnboardingDisabled() || localStorage.getItem(onboardedKey(name))) return () => {};

	const pending = { name, config };
	if (batch.length === 0) setTimeout(flushBatch);
	batch.push(pending);
	return () => cancel(pending);
}

function flushBatch() {
	// Svelte mounts a page before its layouts, so tours registered in the same
	// tick arrive innermost first. Reverse them so the layout's tour plays first.
	queue.push(...batch.reverse());
	batch = [];
	next();
}

function next() {
	if (active) return;
	// The user may have opted out through the previous tour's skip button.
	if (isOnboardingDisabled()) queue.length = 0;
	const pending = queue.shift();
	if (!pending) return;

	localStorage.setItem(onboardedKey(pending.name), 'true');
	const { onPopoverRender, onHighlightStarted, onDestroyed } = pending.config;
	const tour = driver({
		showProgress: true,
		...pending.config,
		onPopoverRender: (popover, opts) => {
			addSkipOnboardingButton(popover, opts.driver);
			onPopoverRender?.(popover, opts);
		},
		onHighlightStarted: (element, step, opts) => {
			const override = step.data as StageOverride | undefined;
			opts.driver.setConfig({
				...opts.driver.getConfig(),
				stagePadding: override?.stagePadding ?? tourStage.stagePadding,
				stageRadius: override?.stageRadius ?? tourStage.stageRadius
			});
			onHighlightStarted?.(element, step, opts);
		},
		onDestroyed: (element, step, opts) => {
			onDestroyed?.(element, step, opts);
			finish(pending);
		}
	});
	// The tour-wide values (driver.js defaults included) that steps without an
	// override fall back to.
	const { stagePadding, stageRadius } = tour.getConfig();
	const tourStage = { stagePadding, stageRadius };
	active = { pending, tour };
	tour.drive();
}

function finish(pending: PendingTour) {
	if (active?.pending !== pending) return;
	active = null;
	// Let driver.js finish tearing down its overlay before the next tour builds one.
	setTimeout(next);
}

function cancel(pending: PendingTour) {
	batch = batch.filter((t) => t !== pending);
	const index = queue.indexOf(pending);
	if (index !== -1) queue.splice(index, 1);
	if (active?.pending === pending) {
		active.tour.destroy();
		// onDestroyed is skipped if no step was highlighted yet.
		finish(pending);
	}
}
