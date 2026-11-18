// Which outline entry the guide is scrolled to.

/**
 * The outline entry `scroller` is at: the last of `ids`, in page order, whose
 * element's top has passed the reading line, a third of the way down the
 * view -- what is being read, rather than what scrolled out at the top. The
 * line is never above where an outline link scrolls an entry to (`scroll-mt`,
 * 96px at most), so a link's entry counts as reached.
 *
 * Scrolled to the bottom, the last entries may never get there: then it is
 * the last whose top is in view. Undefined when none has been reached.
 */
export function outlineEntryAt(scroller: HTMLElement, ids: string[]): string | undefined {
	const view = scroller.getBoundingClientRect();
	const top = view.top + scroller.clientTop;
	const line = top + Math.max(120, scroller.clientHeight / 3);
	const atBottom =
		scroller.scrollTop > 0 &&
		scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
	let reached: string | undefined;
	for (const id of ids) {
		const element = document.getElementById(id);
		if (!element) continue;
		const elementTop = element.getBoundingClientRect().top;
		if (elementTop <= line || (atBottom && elementTop < view.bottom)) reached = id;
	}
	return reached;
}

/**
 * The outline entry `element` is in: the innermost of its ancestors (or
 * itself) whose id is one of `ids`, below `root`.
 */
export function outlineEntryOf(
	element: Element | null,
	ids: Set<string>,
	root: Element
): string | undefined {
	for (let at = element; at && at !== root; at = at.parentElement) {
		if (ids.has(at.id)) return at.id;
	}
	return undefined;
}

/**
 * The outline entry the URL's `#` names, if it names one of `ids`. A `#` that
 * is not valid percent-encoding (`#%E0`) names none, rather than throwing.
 */
export function outlineEntryOfHash(hash: string, ids: string[]): string | undefined {
	let id: string;
	try {
		id = decodeURIComponent(hash.slice(1));
	} catch {
		return undefined;
	}
	return ids.includes(id) ? id : undefined;
}

/**
 * Marks the entry the URL's `#` names as the current one, before the page is
 * first painted: run inline, right after the outline's `<nav>`, as the page
 * is parsed. The server never sees the `#`, so its page marks Framing;
 * hydration then starts from the same entry (`outlineEntryOfHash`), and
 * nothing flickers. A link's `aria-current` is what styles it as current.
 */
export const MARK_HASH_ENTRY = `(() => {
	const nav = document.currentScript.previousElementSibling;
	let id;
	try {
		id = decodeURIComponent(location.hash.slice(1));
	} catch {
		return;
	}
	const link = id && nav.querySelector('a[href="#' + CSS.escape(id) + '"]');
	if (!link) return;
	nav.querySelector('[aria-current]')?.removeAttribute('aria-current');
	link.setAttribute('aria-current', 'location');
})();`;
