import { SvelteSet } from 'svelte/reactivity';

/** Below this the right margin is too narrow for a comment card. */
const MARGIN_BREAKPOINT = 1280;

/**
 * Where a message's discussion opens, and which ones are open.
 *
 * Wide screens float the thread in the right margin, so reading a discussion
 * never pushes the transcript around; narrower ones get a modal instead. Both
 * the annotate view and the interview transcript drive this the same way, so
 * the two behave alike down to which key closes what.
 */
export class CommentSurface {
	/** True while the viewport can host margin cards. */
	useMargin = $state(true);
	#openInMargin = new SvelteSet<string>();
	modalMessageId = $state<string | null>(null);

	/** Call on mount and on resize; window is not readable during SSR. */
	syncWidth() {
		this.useMargin = window.innerWidth >= MARGIN_BREAKPOINT;
	}

	isOpen(messageId: string): boolean {
		return this.#openInMargin.has(messageId) || this.modalMessageId === messageId;
	}

	open(messageId: string) {
		if (this.useMargin) {
			this.#openInMargin.add(messageId);
		} else {
			this.modalMessageId = messageId;
		}
	}

	close(messageId: string) {
		this.#openInMargin.delete(messageId);
		if (this.modalMessageId === messageId) this.modalMessageId = null;
	}

	toggle(messageId: string) {
		if (this.isOpen(messageId)) {
			this.close(messageId);
		} else {
			this.open(messageId);
		}
	}

	/**
	 * What Escape should close: the modal if one is up, otherwise every margin
	 * thread. Returns whether anything was closed, so a caller can leave the
	 * key to whatever else wants it.
	 */
	closeTopmost(): boolean {
		if (this.modalMessageId) {
			this.modalMessageId = null;
			return true;
		}
		if (this.#openInMargin.size > 0) {
			this.#openInMargin.clear();
			return true;
		}
		return false;
	}
}
