import { Analysis } from '$lib/api';

import { codesFromApi, codesToApi } from './codebookApi';
import { CodingTreeState } from './codingTreeState.svelte';

/**
 * One codebook per project, shared by every view of it, and saved.
 *
 * The canvas used to own its state outright, which was fine while it was the
 * only way to edit a codebook. It is not any more: the explore page's code
 * pane edits the same tree, and two `new CodingTreeState()` calls would hand
 * the reader two codebooks that disagree the moment either is touched -- with
 * the disagreement invisible, because each view only ever draws its own.
 *
 * Keyed by project and not by language, because a codebook is not a
 * translation of anything: the same codes are applied to Danish and English
 * transcripts alike, and a per-language codebook would make cross-language
 * comparison impossible by construction. The backend agrees -- `code` hangs
 * off `project`.
 *
 * Module-level, so the tree survives navigating between the routes without a
 * refetch. Every route that reaches this sets `ssr = false`, so it is only
 * ever built in a browser and cannot become one process's state leaking
 * between readers.
 */

/** How long a burst of edits is allowed to run before it is written. */
const SAVE_DELAY = 800;

export class Codebook {
	readonly tree = new CodingTreeState();
	readonly projectId: string;

	/**
	 * `loading` until the first read finishes, whatever it finds. The editor is
	 * not shown before then: it would open on an empty codebook, and the first
	 * keystroke would save that emptiness over the stored one.
	 */
	status = $state<'loading' | 'ready' | 'error'>('loading');
	/** What went wrong, for the reader. Set on a failed read or write. */
	error = $state<string | null>(null);
	saving = $state(false);
	/** True between an edit and the write that stores it. */
	dirty = $state(false);

	/** The revision last written, so an idle tree is never written again. */
	#saved = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#reading: Promise<void> | null = null;

	constructor(projectId: string) {
		this.projectId = projectId;
	}

	/** Reads the stored codebook, once. Repeated calls await the first. */
	read(): Promise<void> {
		if (!this.#reading) this.#reading = this.#read();
		return this.#reading;
	}

	async #read() {
		const { data, error } = await Analysis.getCodebook({
			path: { project_id: this.projectId }
		});
		if (error || !data) {
			this.status = 'error';
			this.error = 'Could not load this project’s codebook.';
			// Left unresolved on purpose: a retry has to re-read, and a resolved
			// promise here would make every later `read()` a no-op that reports
			// success.
			this.#reading = null;
			return;
		}
		this.tree.load(codesFromApi(data.codes), data.palette);
		this.#saved = this.tree.revision;
		this.status = 'ready';
		this.error = null;
	}

	/**
	 * Notes that the tree is at `revision` and schedules a write if it is ahead
	 * of what is stored.
	 *
	 * Called from an effect in whichever view is mounted, rather than from an
	 * effect here: this object outlives every component that reads it, and an
	 * effect created outside one has no owner to be cleaned up with. Two views
	 * calling it is harmless -- the second finds the timer already set.
	 */
	sync(revision: number) {
		if (this.status !== 'ready' || revision === this.#saved) return;
		this.dirty = true;
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.flush(), SAVE_DELAY);
	}

	/** Writes now, rather than when the burst of edits settles. */
	async flush() {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		if (this.status !== 'ready' || this.saving) return;

		// Read before awaiting: an edit made during the write is a revision this
		// write does not contain, and recording the later number would leave it
		// unsaved forever.
		const revision = this.tree.revision;
		if (revision === this.#saved) {
			this.dirty = false;
			return;
		}

		this.saving = true;
		const { data, error } = await Analysis.saveCodebook({
			path: { project_id: this.projectId },
			body: { codes: codesToApi(this.tree.codes), palette: [...this.tree.palette] }
		});
		this.saving = false;

		if (error || !data) {
			this.error = 'Could not save the codebook. Your last change is not stored.';
			return;
		}
		this.error = null;
		this.#saved = revision;
		this.dirty = this.tree.revision !== revision;
		// An edit landed while this was in flight; it still has to be written.
		if (this.dirty) this.sync(this.tree.revision);
	}
}

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a registry of codebooks, never itself read reactively
const books = new Map<string, Codebook>();

/** The codebook for a project, created and read on first ask. */
export function codebookFor(projectId: string): Codebook {
	let book = books.get(projectId);
	if (!book) {
		book = new Codebook(projectId);
		books.set(projectId, book);
	}
	void book.read();
	return book;
}

// A tab closing mid-burst would otherwise lose the edits the debounce is still
// holding. `pagehide` rather than `beforeunload`: it fires on the mobile and
// bfcache paths that `beforeunload` misses.
if (typeof window !== 'undefined') {
	window.addEventListener('pagehide', () => {
		for (const book of books.values()) void book.flush();
	});
}
