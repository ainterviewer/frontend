<script lang="ts">
	import MessageCommentThread from '$lib/components/analysis/MessageCommentThread.svelte';
	import type { CommentSurface } from '$lib/stores/commentSurface.svelte';
	import type { MessageComments } from '$lib/stores/messageComments.svelte';

	interface Props {
		comments: MessageComments;
		surface: CommentSurface;
		currentUserId: string;
		canModerate?: boolean;
	}

	let { comments, surface, currentUserId, canModerate = false }: Props = $props();

	// Escape is handled by the page's window listener, so the modal closes
	// wherever focus happens to be.
</script>

{#if surface.modalMessageId}
	{@const messageId = surface.modalMessageId}
	{@const count = comments.count(messageId)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) surface.close(messageId);
		}}
		role="presentation"
	>
		<div class="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
				<h3 class="text-sm font-medium text-gray-800">
					{count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Add comment'}
				</h3>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close comments"
					onclick={() => surface.close(messageId)}
				>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="overflow-y-auto p-4">
				<MessageCommentThread
					comments={comments.get(messageId)}
					{currentUserId}
					{canModerate}
					pending={comments.isPending(messageId)}
					autofocusComposer={count === 0}
					onAdd={(body, parentId) => comments.add(messageId, body, parentId)}
					onEdit={(commentId, body) => comments.edit(messageId, commentId, body)}
					onDelete={(commentId) => comments.remove(messageId, commentId)}
				/>
			</div>
		</div>
	</div>
{/if}
