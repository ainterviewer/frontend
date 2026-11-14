import type { ChatMessage } from '$lib/api/types.gen';

/**
 * Whether a streamed model frame continues the message shown in `current`.
 *
 * A text frame carries the whole reply so far, and every frame of one reply
 * carries that reply's timestamp, so it replaces the message it grows in.
 * Anything else -- each generated question or section, or a new reply --
 * belongs in a message of its own, or two items of one turn would overwrite
 * each other.
 */
export function continuesReply(current: ChatMessage | undefined, frame: ChatMessage): boolean {
	return (
		(frame.type ?? 'message') === 'message' &&
		(current?.type ?? 'message') === 'message' &&
		current?.timestamp === frame.timestamp
	);
}
