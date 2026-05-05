export function portal(node: HTMLElement, target: HTMLElement | string = document.body) {
	const resolve = (t: HTMLElement | string) =>
		typeof t === 'string' ? (document.querySelector(t) as HTMLElement | null) : t;

	let dest = resolve(target);
	if (dest) dest.appendChild(node);

	return {
		update(newTarget: HTMLElement | string) {
			dest = resolve(newTarget);
			if (dest) dest.appendChild(node);
		},
		destroy() {
			node.parentNode?.removeChild(node);
		}
	};
}
