import { Analysis } from '$lib/api';
import type { CodingCreate, CodingPublic, MessagePublic } from '$lib/api/types.gen';
import { untrack } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

/**
 * The codings of the messages currently on screen.
 *
 * A coding is one application of one code to one passage, by one coder --
 * unlike the annotation envelope it replaces, which held one user's whole
 * reading of a message as a single row. That shape is why this store writes
 * one coding at a time: applying a code is now a complete act rather than an
 * edit to a set, so there is nothing to diff and no moment where a half-saved
 * envelope exists.
 *
 * Authorship is the server's: the caller's token names the coder, and only the
 * coder (or a project moderator) may change or remove one. The UI hides the
 * actions it knows will be refused, and surfaces the error if the server
 * disagrees.
 */
export class MessageCodings {
	/**
	 * The project the messages belong to, read at the moment of the request.
	 *
	 * Every request carries it: the API takes a coding's project from the URL
	 * and refuses an id from anywhere else, so a passage cannot be read or
	 * coded through a project the caller is not on.
	 *
	 * A function rather than a string because the pages holding one of these
	 * derive the id from the route, and a value copied in the constructor would
	 * be the project that was open when the component was created — which after
	 * a client-side navigation is not the project on screen.
	 */
	#projectId: () => string;
	#byMessage = new SvelteMap<string, CodingPublic[]>();
	/** Message ids with a write in flight, so the panel can disable itself. */
	#pending = new SvelteSet<string>();

	constructor(projectId: () => string) {
		this.#projectId = projectId;
	}

	/**
	 * Adopt the codings that came embedded in freshly loaded messages.
	 *
	 * Messages already tracked are left alone: pages append pages of results,
	 * and re-seeding a message would throw away codings made since it loaded.
	 */
	seed(messages: MessagePublic[] | undefined) {
		if (!messages) return;
		for (const message of messages) {
			// Seeding runs inside an $effect; tracking this read would make that
			// effect depend on the very map it is about to write to.
			if (untrack(() => this.#byMessage.has(message.id))) continue;
			this.#byMessage.set(message.id, message.codings ?? []);
		}
	}

	/**
	 * Read the codings of a set of messages, in one request.
	 *
	 * For the surfaces whose messages do not arrive carrying their codings --
	 * explore draws turns out of embedding chunks, which know nothing about
	 * coding. Ids already loaded are skipped, so paging through results asks
	 * only about the new turns; `refresh` forces the lot, for after an edit
	 * made somewhere else.
	 */
	async loadFor(messageIds: string[], refresh = false): Promise<void> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- locals of this one call, never read as state
		const unique = [...new Set(messageIds)];
		const wanted = refresh
			? unique
			: unique.filter((id) => !untrack(() => this.#byMessage.has(id)));
		if (wanted.length === 0) return;

		// Marked as loaded before the request, not after: several cards mount at
		// once, and without this each of them asks about the same turns again
		// before the first answer lands.
		for (const id of wanted) if (!this.#byMessage.has(id)) this.#byMessage.set(id, []);

		const { data, error } = await Analysis.getCodingsForMessages({
			path: { project_id: this.#projectId() },
			body: { message_ids: wanted }
		});
		if (error || !data) {
			console.error('Failed to read codings:', error);
			return;
		}
		// Messages with no codings are left out of the response, and the empty
		// arrays above are already the right answer for them.
		for (const [messageId, codings] of Object.entries(data)) {
			this.#byMessage.set(messageId, codings);
		}
	}

	/** Drop everything — for a reload that replaces the message list wholesale. */
	clear() {
		this.#byMessage.clear();
		this.#pending.clear();
	}

	get(messageId: string): CodingPublic[] {
		return this.#byMessage.get(messageId) ?? [];
	}

	/** Just this coder's, which are the ones they may change. */
	mine(messageId: string, userId: string): CodingPublic[] {
		return this.get(messageId).filter((coding) => coding.user_id === userId);
	}

	count(messageId: string): number {
		return this.get(messageId).length;
	}

	isPending(messageId: string): boolean {
		return this.#pending.has(messageId);
	}

	/**
	 * Whether this coder has already applied `codeId` to this exact passage.
	 *
	 * The span is part of the answer: coding a whole turn and coding nine words
	 * of it are different claims, and the server counts them as different
	 * codings too.
	 */
	has(
		messageId: string,
		userId: string,
		codeId: string,
		start: number | null = null,
		end: number | null = null
	): CodingPublic | undefined {
		return this.get(messageId).find(
			(coding) =>
				coding.user_id === userId &&
				coding.code_id === codeId &&
				(coding.start_offset ?? null) === start &&
				(coding.end_offset ?? null) === end
		);
	}

	async add(messageId: string, coding: CodingCreate): Promise<boolean> {
		this.#pending.add(messageId);
		try {
			const { data, error } = await Analysis.addMessageCoding({
				path: { project_id: this.#projectId(), message_id: messageId },
				body: coding
			});
			if (error || !data) throw error ?? new Error('No coding returned');

			this.#byMessage.set(messageId, [...this.get(messageId), data]);
			return true;
		} catch (e) {
			console.error('Failed to apply code:', e);
			toast.error(detail(e) ?? 'Could not apply the code');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}

	/** Changes a coding in place — in practice, a score's value. */
	async update(messageId: string, codingId: string, coding: CodingCreate): Promise<boolean> {
		this.#pending.add(messageId);
		try {
			const { data, error } = await Analysis.updateMessageCoding({
				path: { project_id: this.#projectId(), coding_id: codingId },
				body: coding
			});
			if (error || !data) throw error ?? new Error('No coding returned');

			this.#byMessage.set(
				messageId,
				this.get(messageId).map((existing) => (existing.id === codingId ? data : existing))
			);
			return true;
		} catch (e) {
			console.error('Failed to change the coding:', e);
			toast.error(detail(e) ?? 'Could not save the change');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}

	async remove(messageId: string, codingId: string): Promise<boolean> {
		this.#pending.add(messageId);
		try {
			const { error } = await Analysis.deleteMessageCoding({
				path: { project_id: this.#projectId(), coding_id: codingId }
			});
			if (error) throw error;

			this.#byMessage.set(
				messageId,
				this.get(messageId).filter((coding) => coding.id !== codingId)
			);
			return true;
		} catch (e) {
			console.error('Failed to remove the coding:', e);
			toast.error(detail(e) ?? 'Could not remove the coding');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}

	/**
	 * Forgets every coding made with a code, for when the codebook drops it.
	 *
	 * The server deletes them with the code; this is the same deletion applied
	 * to what is already on screen, so the reader does not go on seeing chips
	 * for a code that no longer exists.
	 */
	forgetCode(codeId: string) {
		for (const [messageId, codings] of this.#byMessage) {
			if (codings.some((coding) => coding.code_id === codeId)) {
				this.#byMessage.set(
					messageId,
					codings.filter((coding) => coding.code_id !== codeId)
				);
			}
		}
	}
}

/**
 * The server's own words, when it refused for a reason worth repeating.
 *
 * The codings API says exactly what is wrong -- a score off its scale, a group
 * that is not applied to anything, a passage already carrying the code -- and
 * replacing that with "could not apply the code" would hide the one sentence
 * that tells the coder what to do instead.
 */
function detail(error: unknown): string | null {
	if (typeof error !== 'object' || error === null) return null;
	const body = (error as { detail?: unknown }).detail;
	return typeof body === 'string' ? body : null;
}
