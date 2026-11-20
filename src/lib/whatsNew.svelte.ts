import type { PlatformRelease } from '$lib/api';

const LAST_SEEN_KEY = 'whats-new-last-seen';

/**
 * The newest release that actually announces something, or undefined.
 *
 * Not simply `releases[0]`: the API also serves releases curated as having
 * nothing user-facing, which the dialog lists as a maintenance row. Those are
 * worth reading, not worth interrupting for, so the unseen dot skips them.
 *
 * Both the dot and the marker written when the dialog opens read this one
 * value. Letting them diverge latches the dot on forever — `isUnseen` compares
 * with `!==`, so a marker holding a version the dot never asks about can never
 * clear it.
 */
export function newsworthyVersion(releases: PlatformRelease[] | undefined) {
	return releases?.find((release) => release.highlights.length > 0)?.platform_version;
}

/**
 * Versions of the releases the user had not seen when the dialog opened.
 *
 * `releases` is newest first, so these are the ones above the version the user
 * last opened the dialog for. A maintenance release above it counts as unseen
 * too. If that version has dropped off the end of the capped list, everything
 * listed is newer than it.
 *
 * Empty when there is no marker: on a first visit every release is unseen, and
 * flagging all of them tells the user nothing.
 */
export function unseenVersions(
	releases: PlatformRelease[] | undefined,
	seen: string | null
): string[] {
	if (!releases || !seen) return [];
	const seenIndex = releases.findIndex((release) => release.platform_version === seen);
	const unseen = seenIndex === -1 ? releases : releases.slice(0, seenIndex);
	return unseen.map((release) => release.platform_version);
}

/**
 * Open/closed state for the "What's new" dialog, plus the marker for which
 * release the user has already looked at.
 *
 * Shared because the dialog is opened from two places (the header account menu
 * and the sidebar version) but rendered once, in the dashboard layout.
 */
class WhatsNewState {
	isOpen = $state(false);

	/** Newest platform version the user has already seen, or null. */
	lastSeen = $state<string | null>(null);

	/**
	 * What `lastSeen` held when the dialog was last opened.
	 *
	 * Opening the dialog moves the marker to the newest release, so the dialog
	 * reads this snapshot to tell which releases were new to the user.
	 */
	seenBeforeOpen = $state<string | null>(null);

	/** Whether the stored marker has been read yet. */
	hydrated = $state(false);

	/**
	 * Read the stored marker.
	 *
	 * Client-only, and deliberately not done in the constructor: the module is
	 * evaluated before hydration, so reading localStorage there would make the
	 * first client render disagree with the server's.
	 */
	hydrate() {
		if (typeof localStorage === 'undefined') return;
		this.lastSeen = localStorage.getItem(LAST_SEEN_KEY);
		this.hydrated = true;
	}

	/**
	 * Whether there is a release the user has not opened the dialog for yet.
	 *
	 * False until the marker has been read. Otherwise the server — which cannot
	 * see localStorage, so `lastSeen` is null there — would render the dot for
	 * everyone, and hydration would immediately remove it again for users who
	 * had already looked. That flash is worse than showing the dot a beat late.
	 */
	isUnseen(version: string | undefined | null) {
		return this.hydrated && !!version && this.lastSeen !== version;
	}

	/** Opening the dialog is what marks the release as seen. */
	open(latestVersion?: string | null) {
		this.isOpen = true;
		this.seenBeforeOpen = this.lastSeen;
		if (latestVersion) this.markSeen(latestVersion);
	}

	close() {
		this.isOpen = false;
	}

	markSeen(version: string) {
		this.lastSeen = version;
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(LAST_SEEN_KEY, version);
	}
}

export const whatsNew = new WhatsNewState();
