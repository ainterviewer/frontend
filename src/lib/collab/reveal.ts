import type { Attachment } from 'svelte/attachments';

/**
 * Taking an editor to where something is: the block with that DOM id (a
 * question or section renders with its id) scrolls into view and gets a
 * `reveal` event naming the field to open, so a question can expand the
 * panel the field lives in. Centred, since the top of the pane is under the
 * collab pills and the bottom under the action bar.
 */

type RevealDetail = { field: string | null };

export function reveal(id: string, field: string | null = null): void {
	const element = document.getElementById(id);
	if (!element) return;
	element.scrollIntoView({ block: 'center', behavior: 'smooth' });
	element.dispatchEvent(new CustomEvent<RevealDetail>('reveal', { detail: { field } }));
}

/** On the block with the id: `open` is called with the field to reveal. */
export function onReveal(open: (field: string | null) => void): Attachment<HTMLElement> {
	return (element) => {
		const listener = (event: Event) => open((event as CustomEvent<RevealDetail>).detail.field);
		element.addEventListener('reveal', listener);
		return () => element.removeEventListener('reveal', listener);
	};
}
