<script lang="ts">
	import type { MessageCommentPublic } from '$lib/api/types.gen';
	import { authorInitials, authorName, formatCommentTime } from '$lib/utils/annotations';

	interface Props {
		/** Root comments, each carrying its replies. */
		comments: MessageCommentPublic[];
		/** Used to tell own contributions apart, and to decide what can be edited. */
		currentUserId: string;
		/** Project moderators may edit and delete anyone's comment. */
		canModerate?: boolean;
		/** A write on this thread is in flight. */
		pending?: boolean;
		/** Focus the composer as soon as the thread opens. */
		autofocusComposer?: boolean;
		/** Tighter spacing for the margin panel and the modal. */
		compact?: boolean;
		onAdd: (body: string, parentId: string | null) => Promise<boolean>;
		onEdit: (commentId: string, body: string) => Promise<boolean>;
		onDelete: (commentId: string) => Promise<boolean>;
	}

	let {
		comments,
		currentUserId,
		canModerate = false,
		pending = false,
		autofocusComposer = false,
		compact = false,
		onAdd,
		onEdit,
		onDelete
	}: Props = $props();

	let newComment = $state('');
	let replyingTo = $state<string | null>(null);
	let replyBody = $state('');
	let editingId = $state<string | null>(null);
	let editBody = $state('');

	/** Puts the caret in a box the moment it appears — a fresh reply or composer. */
	function focusOnRender(node: HTMLTextAreaElement) {
		node.focus();
	}

	function canModify(comment: MessageCommentPublic): boolean {
		return canModerate || comment.user_id === currentUserId;
	}

	function wasEdited(comment: MessageCommentPublic): boolean {
		return comment.updated_at !== comment.created_at;
	}

	async function submitNew() {
		if (!newComment.trim() || pending) return;
		if (await onAdd(newComment, null)) newComment = '';
	}

	function startReply(commentId: string) {
		replyingTo = commentId;
		replyBody = '';
		editingId = null;
	}

	async function submitReply(parentId: string) {
		if (!replyBody.trim() || pending) return;
		if (await onAdd(replyBody, parentId)) {
			replyBody = '';
			replyingTo = null;
		}
	}

	function startEdit(comment: MessageCommentPublic) {
		editingId = comment.id;
		editBody = comment.body;
		replyingTo = null;
	}

	async function submitEdit(commentId: string) {
		if (!editBody.trim() || pending) return;
		if (await onEdit(commentId, editBody)) {
			editingId = null;
			editBody = '';
		}
	}

	async function remove(comment: MessageCommentPublic) {
		const isRoot = comment.parent_id === null;
		const replyCount = comment.replies?.length ?? 0;
		const question =
			isRoot && replyCount > 0
				? `Delete this comment and its ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}?`
				: 'Delete this comment?';
		if (!confirm(question)) return;
		await onDelete(comment.id);
	}

	/** Ctrl/Cmd+Enter submits, Escape backs out — the usual comment-box contract. */
	function onKeydown(event: KeyboardEvent, submit: () => void, cancel?: () => void) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			submit();
		} else if (event.key === 'Escape' && cancel) {
			event.preventDefault();
			cancel();
		}
	}
</script>

{#snippet comment(entry: MessageCommentPublic, isReply: boolean)}
	{@const isOwn = entry.user_id === currentUserId}
	<div class="flex gap-2">
		<div
			class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold {isOwn
				? 'bg-blue-100 text-blue-700'
				: 'bg-gray-200 text-gray-600'}"
			title={authorName(entry.author)}
		>
			{authorInitials(entry.author)}
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-baseline gap-x-2">
				<span class="text-xs font-medium text-gray-800">
					{authorName(entry.author)}{isOwn ? ' (you)' : ''}
				</span>
				<span class="text-[10px] text-gray-400">
					{formatCommentTime(entry.created_at)}{wasEdited(entry) ? ' · edited' : ''}
				</span>
			</div>

			{#if editingId === entry.id}
				<textarea
					bind:value={editBody}
					rows={compact ? 2 : 3}
					class="mt-1 w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					onkeydown={(e) =>
						onKeydown(
							e,
							() => submitEdit(entry.id),
							() => (editingId = null)
						)}
				></textarea>
				<div class="mt-1 flex justify-end gap-2">
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
						onclick={() => (editingId = null)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
						onclick={() => submitEdit(entry.id)}
						disabled={pending || !editBody.trim()}
					>
						Save
					</button>
				</div>
			{:else}
				<p class="mt-0.5 text-sm whitespace-pre-wrap text-gray-700">{entry.body}</p>
				<div class="mt-0.5 flex items-center gap-3 text-[10px] text-gray-400">
					{#if !isReply}
						<button
							type="button"
							class="hover:text-gray-700"
							onclick={() => (replyingTo === entry.id ? (replyingTo = null) : startReply(entry.id))}
						>
							Reply
						</button>
					{/if}
					{#if canModify(entry)}
						<button type="button" class="hover:text-gray-700" onclick={() => startEdit(entry)}>
							Edit
						</button>
						<button type="button" class="hover:text-red-600" onclick={() => remove(entry)}>
							Delete
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flex flex-col {compact ? 'gap-3' : 'gap-4'}">
	{#each comments as root (root.id)}
		<div class="flex flex-col gap-2">
			{@render comment(root, false)}

			{#if root.replies?.length}
				<div class="ml-3 flex flex-col gap-2 border-l border-gray-200 pl-3">
					{#each root.replies as reply (reply.id)}
						{@render comment(reply, true)}
					{/each}
				</div>
			{/if}

			{#if replyingTo === root.id}
				<div class="ml-3 border-l border-gray-200 pl-3">
					<textarea
						bind:value={replyBody}
						rows="2"
						placeholder="Reply..."
						{@attach focusOnRender}
						class="w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						onkeydown={(e) =>
							onKeydown(
								e,
								() => submitReply(root.id),
								() => (replyingTo = null)
							)}
					></textarea>
					<div class="mt-1 flex justify-end gap-2">
						<button
							type="button"
							class="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
							onclick={() => (replyingTo = null)}
						>
							Cancel
						</button>
						<button
							type="button"
							class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
							onclick={() => submitReply(root.id)}
							disabled={pending || !replyBody.trim()}
						>
							Reply
						</button>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-xs text-gray-400">No comments yet.</p>
	{/each}

	<div class="border-t border-gray-100 pt-2">
		<textarea
			bind:value={newComment}
			{@attach (node: HTMLTextAreaElement) => {
				if (autofocusComposer) focusOnRender(node);
			}}
			rows={compact ? 2 : 3}
			placeholder="Add a comment..."
			class="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			onkeydown={(e) => onKeydown(e, submitNew)}
		></textarea>
		<div class="mt-2 flex items-center justify-between">
			<span class="text-[10px] text-gray-400">⌘/Ctrl + Enter to post</span>
			<button
				type="button"
				class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
				onclick={submitNew}
				disabled={pending || !newComment.trim()}
			>
				{#if pending}
					<i class="fa-solid fa-spinner fa-spin mr-1"></i>
				{/if}
				Comment
			</button>
		</div>
	</div>
</div>
