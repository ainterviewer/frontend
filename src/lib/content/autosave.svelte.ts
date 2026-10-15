import { untrack } from 'svelte';

import { contentRevision, type RevisionKey } from './revision.svelte';

// Saving a page as it is edited, for the pages not co-edited live (agents,
// participant emails, simulation setups): a second after the last change,
// the page's own save runs. The setup pages edited live save through their
// doc instead (`$lib/collab`).
//
// A page hands an `Autosaver` what to save (`read`) and how (`save`), and
// calls `watch()` while it initialises. `AutosavePill` shows the state.

/** How long after the last change a page saves. */
const SAVE_DELAY = 1000;

export type SaveResult =
	| { ok: true }
	/** Someone else saved since this page loaded: the part's revision now. */
	| { ok: false; conflict: number }
	/** What is on the page cannot be saved as it is; says why. */
	| { ok: false; invalid: string }
	| { ok: false; error: string };

export type AutosaveState =
	| 'saved'
	/** Changed, and saving shortly. */
	| 'pending'
	| 'saving'
	/** The last save failed; the next change, or Retry, tries again. */
	| 'failed'
	/** What is on the page cannot be saved as it is (`message` says why). */
	| 'invalid'
	/** Someone else saved meanwhile: autosaving stops until the reader picks
	 * whose version to keep. */
	| 'conflict';

type Options<T> = {
	/** What to save, read from the page's state. Read in an effect, so
	 * everything it reads is watched. */
	read: () => T;
	/** Save `value`; `overwrite` is the revision to save over after a
	 * conflict, when the reader chose to keep their version. */
	save: (value: T, overwrite?: number) => Promise<SaveResult>;
	/** Savers with the same key save one after another: the two participant
	 * emails share a revision, so saved at once each would make the other
	 * stale. */
	queue?: string;
	/** "Load theirs" after a conflict; reloads the page by default. */
	onReload?: () => void;
};

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level queues; nothing renders from them
const queues = new Map<string, Promise<unknown>>();

function queued<R>(key: string | undefined, run: () => Promise<R>): Promise<R> {
	if (!key) return run();
	const result = (queues.get(key) ?? Promise.resolve()).then(run, run);
	queues.set(
		key,
		result.catch(() => {})
	);
	return result;
}

function serialize(value: unknown): string {
	return JSON.stringify(value);
}

export class Autosaver<T> {
	state = $state<AutosaveState>('saved');
	/** Why it is invalid, or why the last save failed. */
	message = $state<string | null>(null);
	/** Whether what is on the page differs from what was last saved. */
	unsaved = $state(false);

	#options: Options<T>;
	/** What was last saved, and what the page holds now, serialized. */
	#baseline: string;
	#latest: string;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#running: Promise<void> | null = null;
	#conflict: number | null = null;

	constructor(options: Options<T>) {
		this.#options = options;
		this.#baseline = this.#latest = serialize(untrack(options.read));
	}

	/** Start saving changes; call while the page initialises. Saves what is
	 * left unsaved when the page goes away. */
	watch() {
		$effect(() => {
			const current = serialize(this.#options.read());
			untrack(() => this.#changed(current));
		});
		$effect(() => () => {
			if (this.unsaved && this.state !== 'conflict') void this.flush();
		});
	}

	/** Take what the page holds now as saved: after it (re)loaded from the
	 * server. */
	reset() {
		this.#clearTimer();
		this.#baseline = this.#latest = serialize(untrack(this.#options.read));
		this.#conflict = null;
		this.unsaved = false;
		this.state = 'saved';
		this.message = null;
	}

	/** Save now, and wait for it: before publishing or sending. Whether
	 * everything on the page is saved. */
	async flush(): Promise<boolean> {
		this.#clearTimer();
		if (this.#running) await this.#running;
		if (this.state === 'conflict') return false;
		if (this.#latest !== this.#baseline) await this.#run();
		return this.state === 'saved';
	}

	/** After a conflict: save this page's version over theirs. */
	async keepMine() {
		if (this.#conflict === null) return;
		await this.#run(this.#conflict);
	}

	/** After a conflict: drop this page's version for theirs. */
	loadTheirs() {
		if (this.#options.onReload) this.#options.onReload();
		else location.reload();
	}

	#changed(current: string) {
		this.#latest = current;
		this.unsaved = current !== this.#baseline;
		if (this.state === 'conflict') return;
		this.#clearTimer();
		if (!this.unsaved) {
			if (!this.#running) {
				this.state = 'saved';
				this.message = null;
			}
			return;
		}
		if (!this.#running) this.state = 'pending';
		this.#timer = setTimeout(() => void this.flush(), SAVE_DELAY);
	}

	#clearTimer() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
	}

	#run(overwrite?: number): Promise<void> {
		const run = async () => {
			const value = untrack(this.#options.read);
			const serialized = serialize(value);
			this.state = 'saving';
			let result: SaveResult;
			try {
				result = await queued(this.#options.queue, () => this.#options.save(value, overwrite));
			} catch (error) {
				console.error('Saving failed', error);
				result = { ok: false, error: 'Not saved' };
			}
			if (result.ok) {
				this.#baseline = serialized;
				this.#conflict = null;
				this.message = null;
				this.unsaved = this.#latest !== this.#baseline;
				this.state = this.unsaved ? 'pending' : 'saved';
				// Changed while it saved: save that too.
				if (this.unsaved) this.#timer = setTimeout(() => void this.flush(), SAVE_DELAY);
			} else if ('conflict' in result) {
				this.#conflict = result.conflict;
				this.state = 'conflict';
				this.message = null;
			} else if ('invalid' in result) {
				this.state = 'invalid';
				this.message = result.invalid;
			} else {
				this.state = 'failed';
				this.message = result.error;
			}
		};
		this.#running = run().finally(() => (this.#running = null));
		return this.#running;
	}
}

type WriteResult = { error?: unknown; response?: Response };
type Headers = { 'if-match'?: string };

/** What a write answered, as a save's result: a 412 is a conflict. */
function outcome(result: WriteResult): SaveResult {
	if (result.response?.status === 412) {
		const current = (result.error as { current_revision?: unknown } | undefined)?.current_revision;
		if (typeof current === 'number') return { ok: false, conflict: current };
	}
	if (result.error) {
		console.error('Saving failed', result.error);
		return { ok: false, error: 'Not saved' };
	}
	return { ok: true };
}

/** `If-Match` for a write based on `etag`, or over `overwrite` after a conflict. */
function ifMatch(etag: string | null | undefined, overwrite?: number): Headers {
	if (overwrite !== undefined) return { 'if-match': `"${overwrite}"` };
	return etag ? { 'if-match': etag } : {};
}

/**
 * A save of a part of the project's content, with `If-Match`: the revision
 * this page last saw, or `overwrite` after a conflict. Records the revision
 * the write returns. For an `Autosaver`'s `save`.
 */
export async function saveContent(
	projectId: string,
	key: RevisionKey,
	write: (headers: Headers) => Promise<WriteResult>,
	overwrite?: number
): Promise<SaveResult> {
	const etag = contentRevision.headers(projectId, key)['if-match'];
	const result = await write(ifMatch(etag, overwrite));
	const saved = outcome(result);
	if (saved.ok) contentRevision.take(projectId, key, result.response);
	return saved;
}

/**
 * `saveContent` for a revision the page holds itself rather than the
 * project's content -- a test setup's: `etag` is what it loaded, moved on
 * by each save.
 */
export async function saveRevisioned(
	etag: { value: string | null },
	write: (headers: Headers) => Promise<WriteResult>,
	overwrite?: number
): Promise<SaveResult> {
	const result = await write(ifMatch(etag.value, overwrite));
	const saved = outcome(result);
	if (saved.ok) etag.value = result.response?.headers.get('etag') ?? etag.value;
	return saved;
}
