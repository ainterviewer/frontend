import { getContext, setContext } from 'svelte';

import type { CodingPublic } from '$lib/api/types.gen';
import type { Code } from '$lib/coding/codingTree';
import type { MessageCodings } from '$lib/stores/messageCodings.svelte';
import type { TextSpan } from '$lib/utils/textSelection';

/**
 * Coding, as the explore page offers it to whatever is drawing a turn.
 *
 * Through context rather than props because the turns are four components
 * deep -- page, list, card, transcript -- and none of the layers in between
 * has anything to do with coding. The alternative is five props threaded
 * through each of them, changed whenever coding changes.
 *
 * Absent by default: `useCodingSurface` returns `null` where nothing provided
 * one, and the transcript then draws the plain reading surface it has always
 * been. That is what keeps the cluster and neighbour panes -- which render the
 * same cards -- from having to opt out.
 */
export type CodeMenuRequest = {
	messageId: string;
	at: { x: number; y: number };
	/**
	 * The turn the click landed on, so the menu can stay with it.
	 *
	 * `at` is where the pointer was, in viewport coordinates, and the menu is
	 * `fixed` -- which on its own leaves it hanging in the middle of the window
	 * while the list scrolls the passage it is about out from under it. Holding
	 * the element lets the menu re-measure it and move by the same amount, so
	 * it keeps the place it opened in *on the page* rather than on the screen.
	 */
	anchor: HTMLElement;
	/** The stretch of the turn the reader had selected, or `null` for all of it. */
	span: TextSpan | null;
	quote: string | null;
};

export type CodingSurface = {
	/** The project's codebook. A getter, so the pane's edits reach the menu. */
	readonly codes: readonly Code[];
	/** Who is coding, so their own chips can carry a remove button. */
	readonly userId: string;
	codingsFor: (messageId: string) => CodingPublic[];
	/** Right-click landed on a turn; the page owns the one menu. */
	openMenu: (request: CodeMenuRequest) => void;
	/**
	 * The request the open menu is about, or `null` when nothing is open.
	 *
	 * Read back so the turn can keep showing which words are being coded. The
	 * menu takes focus the moment it opens — its filter field does — and the
	 * browser stops painting a selection that no longer has focus, so the
	 * reader would be picking a code for a stretch of text nothing points at.
	 */
	readonly pending: CodeMenuRequest | null;
	uncode: (messageId: string, codingId: string) => void;
	/**
	 * The turns now on screen, so their codings can be read in one request.
	 *
	 * Called by whatever draws them, because only it knows which turns those
	 * are: a card's turns come out of a chunk and are not the hits themselves.
	 */
	track: (messageIds: string[]) => void;
};

const KEY = Symbol('explore-coding-surface');

export function provideCodingSurface(surface: CodingSurface): void {
	setContext(KEY, surface);
}

export function useCodingSurface(): CodingSurface | null {
	return getContext<CodingSurface | undefined>(KEY) ?? null;
}

/** Every message id a set of turns points at, for `track`. */
export function turnIds(turns: readonly { id: string }[]): string[] {
	return turns.map((turn) => turn.id);
}

/**
 * This coder's own codings of a passage, as code id to value.
 *
 * Exported for the menu, which reads it twice: a code already on the passage
 * ticks rather than applies again, and a score's scale marks the number it is
 * already set to — so a second click on it can mean "take it off" while a
 * click on any other number means "make it that instead".
 */
export function appliedCodes(
	codings: MessageCodings,
	messageId: string,
	userId: string,
	span: TextSpan | null
): Map<string, number | null> {
	const start = span?.start ?? null;
	const end = span?.end ?? null;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt on every call from reactive reads; never itself state
	return new Map(
		codings
			.get(messageId)
			.filter(
				(coding) =>
					coding.user_id === userId &&
					(coding.start_offset ?? null) === start &&
					(coding.end_offset ?? null) === end
			)
			.map((coding) => [coding.code_id, coding.value_int ?? null])
	);
}
