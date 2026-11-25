/** Room kept between the menu and the edge of the view, in pixels. */
const MARGIN = 8;

/** Where the menu can show: the view, narrowed to its nearest scrolling or
 * clipping ancestor, which would otherwise cut it off. */
function clipBox(menu: HTMLElement): { top: number; bottom: number } {
	for (let el = menu.parentElement; el; el = el.parentElement) {
		if (getComputedStyle(el).overflowY !== 'visible') {
			const box = el.getBoundingClientRect();
			return { top: Math.max(0, box.top), bottom: Math.min(window.innerHeight, box.bottom) };
		}
	}
	return { top: 0, bottom: window.innerHeight };
}

/**
 * An attachment for a menu positioned `absolute` below its trigger (its
 * offset parent): opens it above the trigger instead when it would run past
 * the bottom of the view, or of a list scrolling it, and there is more room
 * above.
 */
export function openUpwards(menu: HTMLElement) {
	const box = menu.getBoundingClientRect();
	const clip = clipBox(menu);
	if (box.bottom + MARGIN <= clip.bottom) return;
	const trigger = (menu.offsetParent ?? menu.parentElement)?.getBoundingClientRect();
	if (!trigger || trigger.top - clip.top < clip.bottom - trigger.bottom) return;
	menu.style.top = 'auto';
	menu.style.bottom = '100%';
	menu.style.marginTop = '0';
	menu.style.marginBottom = `${MARGIN}px`;
}
