import { Analysis } from '$lib/api';
import type { MessageCommentPublic, MessagePublic } from '$lib/api/types.gen';
import { countComments } from '$lib/utils/annotations';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

/**
 * The discussion threads of the messages currently on screen.
 *
 * Threads are two levels deep: root comments each carrying their replies, the
 * shape the API returns. Mutations go straight to the API and patch the local
 * tree on success, so a thread never has to be refetched after a write.
 *
 * Authorship is the server's: the caller's token names the author, and only the
 * author (or a project moderator) may edit or delete. The UI hides the actions
 * it knows will be refused, and surfaces the 403 if the server disagrees.
 */
export class MessageComments {
	#threads = new SvelteMap<string, MessageCommentPublic[]>();
	/**
	 * Which messages have been seeded. A plain Set on purpose: seeding runs
	 * inside an $effect, and reading the reactive map there would make the
	 * effect depend on state it writes itself.
	 */
	#seeded = new Set<string>();
	/** Message ids with a write in flight, so composers can disable themselves. */
	#pending = new SvelteSet<string>();

	/**
	 * Adopt the comments that came embedded in freshly loaded messages.
	 *
	 * Messages already tracked are left alone: pages append pages of results,
	 * and re-seeding an existing thread would throw away local edits.
	 */
	seed(messages: MessagePublic[] | undefined) {
		if (!messages) return;
		for (const message of messages) {
			if (this.#seeded.has(message.id)) continue;
			this.#seeded.add(message.id);
			this.#threads.set(message.id, message.comments ?? []);
		}
	}

	/** Drop everything — for a reload that replaces the message list wholesale. */
	clear() {
		this.#threads.clear();
		this.#seeded.clear();
		this.#pending.clear();
	}

	/** Every write goes through here so a thread is never re-seeded over. */
	#write(messageId: string, thread: MessageCommentPublic[]) {
		this.#seeded.add(messageId);
		this.#threads.set(messageId, thread);
	}

	get(messageId: string): MessageCommentPublic[] {
		return this.#threads.get(messageId) ?? [];
	}

	/** Roots plus replies. */
	count(messageId: string): number {
		return countComments(this.#threads.get(messageId));
	}

	isPending(messageId: string): boolean {
		return this.#pending.has(messageId);
	}

	async add(messageId: string, body: string, parentId: string | null = null): Promise<boolean> {
		const text = body.trim();
		if (!text) return false;

		this.#pending.add(messageId);
		try {
			const { data, error } = await Analysis.addMessageComment({
				path: { message_id: messageId },
				body: { body: text, parent_id: parentId }
			});
			if (error || !data) throw error ?? new Error('No comment returned');

			const thread = [...this.get(messageId)];
			if (data.parent_id) {
				const rootIndex = thread.findIndex((root) => root.id === data.parent_id);
				if (rootIndex === -1) return false;
				const root = thread[rootIndex];
				thread[rootIndex] = { ...root, replies: [...(root.replies ?? []), data] };
			} else {
				thread.push(data);
			}
			this.#write(messageId, thread);
			return true;
		} catch (e) {
			console.error('Failed to add comment:', e);
			toast.error(parentId ? 'Could not post reply' : 'Could not post comment');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}

	async edit(messageId: string, commentId: string, body: string): Promise<boolean> {
		const text = body.trim();
		if (!text) return false;

		this.#pending.add(messageId);
		try {
			const { data, error } = await Analysis.updateMessageComment({
				path: { comment_id: commentId },
				body: { body: text }
			});
			if (error || !data) throw error ?? new Error('No comment returned');

			this.#write(
				messageId,
				this.get(messageId).map((root) => {
					if (root.id === commentId) return { ...data, replies: root.replies ?? [] };
					if (!root.replies?.some((reply) => reply.id === commentId)) return root;
					return {
						...root,
						replies: root.replies.map((reply) => (reply.id === commentId ? data : reply))
					};
				})
			);
			return true;
		} catch (e) {
			console.error('Failed to update comment:', e);
			toast.error('Could not save the change');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}

	/** Deleting a root deletes its replies with it, as it does server-side. */
	async remove(messageId: string, commentId: string): Promise<boolean> {
		this.#pending.add(messageId);
		try {
			const { error } = await Analysis.deleteMessageComment({
				path: { comment_id: commentId }
			});
			if (error) throw error;

			this.#write(
				messageId,
				this.get(messageId)
					.filter((root) => root.id !== commentId)
					.map((root) =>
						root.replies?.some((reply) => reply.id === commentId)
							? { ...root, replies: root.replies.filter((reply) => reply.id !== commentId) }
							: root
					)
			);
			return true;
		} catch (e) {
			console.error('Failed to delete comment:', e);
			toast.error('Could not delete the comment');
			return false;
		} finally {
			this.#pending.delete(messageId);
		}
	}
}
