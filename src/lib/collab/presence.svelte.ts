import type { Action } from 'svelte/action';

import type { GuideSession, Peer } from './guideSession.svelte';

// Where everyone is, by block: the question, section or top-level field
// (`framing`, ...) whose element has that id. Blocks rather than single
// fields because the editor's panels open and close per person, so a field
// one person sees the other may not; the block is always there.

type Params = {
	session: GuideSession;
	/** Whether an element id names a block. */
	isBlock: (id: string) => boolean;
};

const RING = 'presence-ring';

function blockOf(el: Element | null, isBlock: (id: string) => boolean): string | null {
	for (let node = el; node; node = node.parentElement) {
		if (node.id && isBlock(node.id)) return node.id;
	}
	return null;
}

/** Report this tab's block from focus, and ring the blocks others are in. */
export const presence: Action<HTMLElement, Params> = (root, initial) => {
	let params = initial;
	let ringed: HTMLElement[] = [];

	const onFocusIn = (e: FocusEvent) =>
		params.session.setBlock(blockOf(e.target as Element, params.isBlock));
	const onFocusOut = (e: FocusEvent) => {
		if (!root.contains(e.relatedTarget as Node | null)) params.session.setBlock(null);
	};
	root.addEventListener('focusin', onFocusIn);
	root.addEventListener('focusout', onFocusOut);

	function ring(peers: Peer[]) {
		for (const el of ringed) {
			el.classList.remove(RING);
			el.style.removeProperty('--presence-color');
			delete el.dataset.presence;
		}
		ringed = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local of this one call, never state
		const byBlock = new Map<string, Peer[]>();
		for (const peer of peers) {
			if (!peer.block) continue;
			byBlock.set(peer.block, [...(byBlock.get(peer.block) ?? []), peer]);
		}
		for (const [block, here] of byBlock) {
			const el = document.getElementById(block);
			if (!el || !root.contains(el)) continue;
			el.classList.add(RING);
			el.style.setProperty('--presence-color', here[0].color);
			el.dataset.presence = here.map((p) => p.name).join(', ');
			ringed.push(el);
		}
	}

	// Peers is reactive state; re-ring whenever it (or the blocks) change.
	const stop = $effect.root(() => {
		$effect(() => ring(params.session.peers));
	});

	return {
		update(next) {
			params = next;
		},
		destroy() {
			root.removeEventListener('focusin', onFocusIn);
			root.removeEventListener('focusout', onFocusOut);
			stop();
			ring([]);
		}
	};
};
