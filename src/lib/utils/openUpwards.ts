/** Room kept between the menu and the edge of the view, in pixels. */
const MARGIN = 8;

/**
 * An attachment for a menu positioned `absolute` below its trigger (its
 * offset parent): opens it above the trigger instead when it would run past
 * the bottom of the view and there is more room above.
 */
export function openUpwards(menu: HTMLElement) {
	const box = menu.getBoundingClientRect();
	if (box.bottom + MARGIN <= window.innerHeight) return;
	const trigger = (menu.offsetParent ?? menu.parentElement)?.getBoundingClientRect();
	if (!trigger || trigger.top < window.innerHeight - trigger.bottom) return;
	menu.style.top = 'auto';
	menu.style.bottom = '100%';
	menu.style.marginTop = '0';
	menu.style.marginBottom = `${MARGIN}px`;
}
