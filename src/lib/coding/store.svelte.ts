import { CodingTreeState } from './codingTreeState.svelte';

/**
 * One codebook per project, shared by every view of it.
 *
 * The canvas used to own its state outright, which was fine while it was the
 * only way to edit a codebook. It is not any more: the explore page's code
 * pane edits the same tree, and two `new CodingTreeState()` calls would hand
 * the reader two codebooks that disagree the moment either is touched -- with
 * the disagreement invisible, because each view only ever draws its own.
 *
 * Module-level, so the tree survives navigating between the two routes. It does
 * not survive a reload: there is still no backend, and inventing a localStorage
 * format now would mean migrating it away once the API lands. Both routes set
 * `ssr = false`, so this is only ever reached in a browser and cannot become
 * one process's state leaking between readers.
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a registry of states, never itself read reactively
const stores = new Map<string, CodingTreeState>();

/** The codebook for a project and language, created on first ask. */
export function codingTreeFor(projectId: string, lang: string): CodingTreeState {
	const key = `${projectId}/${lang}`;
	let store = stores.get(key);
	if (!store) {
		store = new CodingTreeState();
		stores.set(key, store);
	}
	return store;
}
