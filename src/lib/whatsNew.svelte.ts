const LAST_SEEN_KEY = 'whats-new-last-seen';

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
	 * Read the stored marker.
	 *
	 * Client-only, and deliberately not done in the constructor: the module is
	 * evaluated before hydration, so reading localStorage there would make the
	 * first client render disagree with the server's.
	 */
	hydrate() {
		if (typeof localStorage === 'undefined') return;
		this.lastSeen = localStorage.getItem(LAST_SEEN_KEY);
	}

	/** Whether there is a release the user has not opened the dialog for yet. */
	isUnseen(version: string | undefined | null) {
		return !!version && this.lastSeen !== version;
	}

	/** Opening the dialog is what marks the release as seen. */
	open(latestVersion?: string | null) {
		this.isOpen = true;
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
