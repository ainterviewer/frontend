import { toast } from 'svelte-sonner';

import { browser } from '$app/environment';

// A project's content -- guide, consent, welcome, agents, participant emails --
// has one revision on the server (`projectcontent.revision`). Every content
// GET returns it as `ETag`, and every content write must send it back as
// `If-Match`: a write based on a revision someone else has since moved on from
// is refused with a 412, rather than silently overwriting their work.
//
// One revision for all of it, so it is held here rather than per page: the
// setup pages, the publish control and the email editor all write against the
// same counter. Only ever set in the browser -- module state on the server is
// shared between every request.

class ContentRevision {
	projectId = $state<string | null>(null);
	etag = $state<string | null>(null);

	/** Record the revision a page loaded, or a response carried. */
	set(projectId: string, etag: string | null | undefined) {
		if (!browser || !etag) return;
		this.projectId = projectId;
		this.etag = etag;
	}

	/** Record the `ETag` on `response`, if it has one. */
	take(projectId: string, response: Response | undefined) {
		this.set(projectId, response?.headers.get('etag'));
	}

	/** The `If-Match` header for a write to `projectId`'s content. */
	headers(projectId: string): { 'if-match'?: string } {
		return this.projectId === projectId && this.etag ? { 'if-match': this.etag } : {};
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
 * Run a content write with `If-Match`, and record the revision it returns.
 *
 * When someone else saved in between (412), asks what to do instead of failing
 * quietly: *Overwrite* retries the same write against the current revision,
 * replacing what they saved; *Reload* (or dismissing) gives up, resolving with
 * the 412 so the caller keeps its unsaved edits on screen. `what` names the
 * thing saved, for the message.
 */
export async function saveWithRevision<R extends WriteResult>(
	projectId: string,
	what: string,
	write: (headers: { 'if-match'?: string }) => Promise<R>
): Promise<R> {
	const result = await write(contentRevision.headers(projectId));
	const current = staleRevision(result);
	if (current === null) {
		contentRevision.take(projectId, result.response);
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
					contentRevision.take(projectId, retried.response);
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

/** Whether a failed write was a 412 the user chose not to overwrite. */
export function isStale(result: WriteResult): boolean {
	return result.response?.status === 412;
}
