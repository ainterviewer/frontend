import { toast } from 'svelte-sonner';

import { browser } from '$app/environment';
import type { ContentPart } from '$lib/api/types.gen';

// Each part of a project's content -- guide, consent, welcome, agents,
// participant emails, languages -- has its own revision on the server
// (`projectcontent.<part>_revision`), and the content as a whole one more that
// moves with any of them. A part's GET returns its revision as `ETag`, and
// that part's write must send it back as `If-Match`: a write based on a
// revision someone else has since moved on from is refused with a 412, rather
// than silently overwriting their work. Saving one part never makes another
// look stale.
//
// Publishing and restoring cover every part, so they write against the whole
// (`'content'`): the versions status `ETag`, taken when the publish dialog or
// the history loads it.
//
// Held here rather than per page, so the setup pages, the publish control and
// the email editor share them. Only ever set in the browser -- module state on
// the server is shared between every request.

/** A part, or `'content'` for the whole. */
export type RevisionKey = ContentPart | 'content';

class ContentRevision {
	projectId = $state<string | null>(null);
	etags = $state<Partial<Record<RevisionKey, string>>>({});
	/**
	 * Counts the part revisions this tab has seen move, for what follows the
	 * draft (the publish badge, the history). Not moved by `'content'`, which
	 * those read themselves.
	 */
	changes = $state(0);

	/** Record the revision of `key` a page loaded, or a response carried. */
	set(projectId: string, key: RevisionKey, etag: string | null | undefined) {
		if (!browser || !etag) return;
		if (this.projectId !== projectId) {
			this.projectId = projectId;
			this.etags = {};
		}
		if (this.etags[key] === etag) return;
		this.etags[key] = etag;
		if (key !== 'content') this.changes++;
	}

	/** Record the `ETag` on `response`, if it has one. */
	take(projectId: string, key: RevisionKey, response: Response | undefined) {
		this.set(projectId, key, response?.headers.get('etag'));
	}

	/** Record a revision a response body carried, rather than its `ETag`. */
	setNumber(projectId: string, key: RevisionKey, revision: number | undefined) {
		if (revision !== undefined) this.set(projectId, key, `"${revision}"`);
	}

	/** The `If-Match` header for a write to `key` of `projectId`'s content. */
	headers(projectId: string, key: RevisionKey): { 'if-match'?: string } {
		const etag = this.projectId === projectId ? this.etags[key] : undefined;
		return etag ? { 'if-match': etag } : {};
	}
}

export const contentRevision = new ContentRevision();

/** The revision a server-side load read, for the page to hand to `contentRevision`. */
export function etagOf(response: Response | undefined): string | null {
	return response?.headers.get('etag') ?? null;
}

type WriteResult = { error?: unknown; response?: Response };

function staleRevision(result: WriteResult): number | null {
	if (result.response?.status !== 412) return null;
	const current = (result.error as { current_revision?: unknown } | undefined)?.current_revision;
	return typeof current === 'number' ? current : null;
}

/**
 * Run a write to `key` with `If-Match`, and record the revision it returns.
 *
 * When someone else saved in between (412), asks what to do instead of failing
 * quietly: *Overwrite* retries the same write against the current revision,
 * replacing what they saved; *Reload* (or dismissing) gives up, resolving with
 * the 412 so the caller keeps its unsaved edits on screen. `what` names what
 * the caller loaded, for the message.
 */
export async function saveWithRevision<R extends WriteResult>(
	projectId: string,
	key: RevisionKey,
	what: string,
	write: (headers: { 'if-match'?: string }) => Promise<R>
): Promise<R> {
	const result = await write(contentRevision.headers(projectId, key));
	const current = staleRevision(result);
	if (current === null) {
		contentRevision.take(projectId, key, result.response);
		return result;
	}

	return new Promise<R>((resolve) => {
		let settled = false;
		const settle = (value: R) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		toast.warning(`Someone else saved changes to this project since you opened ${what}.`, {
			description: 'Overwrite replaces their changes with yours. Reload shows theirs.',
			duration: Infinity,
			action: {
				label: 'Overwrite',
				onClick: async () => {
					const retried = await write({ 'if-match': `"${current}"` });
					contentRevision.take(projectId, key, retried.response);
					settle(retried);
				}
			},
			cancel: {
				label: 'Reload',
				onClick: () => {
					settle(result);
					location.reload();
				}
			},
			onDismiss: () => settle(result)
		});
	});
}
