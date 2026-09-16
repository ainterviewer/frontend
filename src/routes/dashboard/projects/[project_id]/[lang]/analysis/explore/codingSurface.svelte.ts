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
 * Whether a codings store already holds this store's own view of a coding.
 *
 * Exported for the menu: a code already on the passage should tick rather than
 * be applied again, and the server refuses a duplicate anyway.
 */
export function appliedCodeIds(
	codings: MessageCodings,
	messageId: string,
	userId: string,
	span: TextSpan | null
): Set<string> {
	const start = span?.start ?? null;
	const end = span?.end ?? null;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt on every call from reactive reads; never itself state
	return new Set(
		codings
			.get(messageId)
			.filter(
				(coding) =>
					coding.user_id === userId &&
					(coding.start_offset ?? null) === start &&
					(coding.end_offset ?? null) === end
			)
			.map((coding) => coding.code_id)
	);
}
