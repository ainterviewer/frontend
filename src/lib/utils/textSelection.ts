/**
 * Reading a text selection back as offsets into the string it renders.
 *
 * Used where the rendering is not ours to control — a message bubble that may
 * draw markdown, search marks, survey options or a picture. The guard is
 * therefore not "is the selection inside this element" but "does this element
 * render exactly this string": only then do the characters on screen line up
 * with the characters an offset counts, and only then is a span a true claim
 * about the stored message. Anywhere else the caller is told there is no
 * selection and falls back to coding the whole turn, which is never wrong.
 */
export type TextSpan = { start: number; end: number };

/**
 * The reader's selection, as offsets into `text`, or `null`.
 *
 * `null` covers every case where the answer would be a guess: nothing
 * selected, a selection outside `container`, a selection spanning more than
 * the one turn, or a rendering that is not character-identical to `text`.
 */
export function selectionWithin(container: HTMLElement, text: string): TextSpan | null {
	const selection = document.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

	const range = selection.getRangeAt(0);
	if (!container.contains(range.commonAncestorContainer)) return null;

	const host = hostOf(container, range, text);
	if (!host) return null;

	const start = offsetOf(host, range.startContainer, range.startOffset);
	const end = offsetOf(host, range.endContainer, range.endOffset);
	if (start === null || end === null || start === end) return null;

	return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** The element inside `container` that renders exactly `text` and holds the range. */
function hostOf(container: HTMLElement, range: Range, text: string): HTMLElement | null {
	if (container.textContent === text) return container;
	for (const element of container.querySelectorAll<HTMLElement>('*')) {
		if (element.textContent === text && element.contains(range.commonAncestorContainer)) {
			return element;
		}
	}
	return null;
}

/** How many characters of `host` come before a point in it. */
function offsetOf(host: HTMLElement, node: Node, offset: number): number | null {
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	let total = 0;
	let text = walker.nextNode();
	while (text) {
		if (text === node) return total + offset;
		total += text.textContent?.length ?? 0;
		text = walker.nextNode();
	}
	// The point is an element rather than a text node — a selection that ended
	// on a boundary. `offset` then counts child nodes, not characters, so the
	// only honest answers are "the whole thing" or nothing.
	return node === host ? total : null;
}
