<script lang="ts">
	import type {
		AnalysisCategoryPublic,
		AnnotationValueCreate,
		MessageAnnotationPublic
	} from '$lib/api/types.gen';
	import AnnotationChips from '$lib/components/analysis/AnnotationChips.svelte';
	import MessageAnnotationPanel from '$lib/components/analysis/MessageAnnotationPanel.svelte';
	import MessageCommentThread from '$lib/components/analysis/MessageCommentThread.svelte';
	import InterviewMessage from '$lib/components/interview/InterviewMessage.svelte';
	import type { Message } from '$lib/components/interview/types';
	import type { CommentSurface } from '$lib/stores/commentSurface.svelte';
	import type { MessageComments } from '$lib/stores/messageComments.svelte';
	import { authorName } from '$lib/utils/annotations';
	import type { Snippet } from 'svelte';

	interface Props {
		message: Message;
		messageId: string;
		lang: string;
		projectId: string;
		categories: AnalysisCategoryPublic[];
		/** The current user's coding of this message: the editable one. */
		annotation?: MessageAnnotationPublic | null;
		/** Everybody else's, shown read-only. */
		otherAnnotations?: MessageAnnotationPublic[];
		comments: MessageComments;
		surface: CommentSurface;
		currentUserId: string;
		canModerate?: boolean;
		/** Hidden where the project has no categories to annotate with. */
		canAnnotate?: boolean;
		annotationOpen: boolean;
		savingAnnotation?: boolean;
		/** Context messages the reader pulled in are dimmed. */
		dimmed?: boolean;
		onToggleAnnotation: () => void;
		onSaveAnnotation: (values: AnnotationValueCreate[], shouldClose?: boolean) => void;
		onDeleteAnnotation?: () => void;
		onCancelAnnotation: () => void;
		onCategoryCreated?: () => void;
		/** Rendered above the message — the annotate view's "show context" button. */
		beforeMessage?: Snippet;
		/** Rendered directly under the message — the transcript's audio player. */
		underMessage?: Snippet;
		/** Rendered below everything, inside the same positioning context. */
		afterMessage?: Snippet;
	}

	let {
		message,
		messageId,
		lang,
		projectId,
		categories,
		annotation = null,
		otherAnnotations = [],
		comments,
		surface,
		currentUserId,
		canModerate = false,
		canAnnotate = true,
		annotationOpen,
		savingAnnotation = false,
		dimmed = false,
		onToggleAnnotation,
		onSaveAnnotation,
		onDeleteAnnotation,
		onCancelAnnotation,
		onCategoryCreated,
		beforeMessage,
		underMessage,
		afterMessage
	}: Props = $props();

	let commentCount = $derived(comments.count(messageId));
	let isCommentOpen = $derived(surface.isOpen(messageId));
	let thread = $derived(comments.get(messageId));
	// A message with no discussion keeps its margin empty rather than showing an
	// invitation next to every line of the transcript.
	let hasMarginCard = $derived(surface.useMargin && (isCommentOpen || commentCount > 0));
	let commentLabel = $derived(
		commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add comment'
	);
	let isFromInterviewer = $derived(message.type === 'received');
</script>

{#snippet annotateBadge()}
	{#if canAnnotate}
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500 opacity-0 transition-all group-hover:opacity-100 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:opacity-100"
			onclick={onToggleAnnotation}
		>
			<i class="fa-solid fa-tag text-[8px]"></i>
			{annotation ? 'Edit annotation' : 'Annotate'}
		</button>
	{/if}
{/snippet}

<div class="group relative {dimmed ? 'opacity-60' : ''}">
	{@render beforeMessage?.()}

	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<InterviewMessage
				{message}
				{lang}
				isLast={false}
				readonly={true}
				onFeedback={() => {}}
				onSkip={() => {}}
				onSurveyAnswer={() => {}}
			/>

			{@render underMessage?.()}

			<!-- Annotation summary and the annotate affordance -->
			<div
				class="mt-1 flex flex-wrap items-center gap-1.5 {isFromInterviewer
					? 'ml-2.5 sm:ml-[50px]'
					: 'mr-2.5 justify-end sm:mr-[50px]'}"
			>
				{#if !isFromInterviewer}
					{@render annotateBadge()}
				{/if}
				{#if annotation}
					<AnnotationChips {annotation} {categories} />
				{/if}
				{#each otherAnnotations as other (other.id)}
					<AnnotationChips annotation={other} {categories} showAuthor />
				{/each}
				{#if isFromInterviewer}
					{@render annotateBadge()}
				{/if}
			</div>
		</div>

		<!-- Comment button -->
		<div class="flex-shrink-0 self-start pt-2">
			<button
				type="button"
				class="flex h-7 items-center justify-center gap-1 rounded-full px-2 transition-all {commentCount >
				0
					? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
					: 'w-7 bg-gray-100 px-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600 focus-visible:opacity-100'}"
				onclick={() => surface.toggle(messageId)}
				title={commentLabel}
			>
				<i class="fa-solid fa-comment text-xs"></i>
				{#if commentCount > 0}
					<span class="text-[10px] font-medium">{commentCount}</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Thread teaser for screens with no room for a margin (opens the modal) -->
	{#if !surface.useMargin && commentCount > 0}
		{@const latest = thread.at(-1)}
		<button
			type="button"
			class="group/comment mt-2 w-full cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2 text-left transition-shadow hover:shadow-sm"
			onclick={() => surface.open(messageId)}
		>
			<p class="line-clamp-2 text-sm whitespace-pre-wrap text-gray-700">
				{#if latest}
					<span class="font-medium">{authorName(latest.author)}:</span>
					{latest.body}
				{/if}
			</p>
			<div class="mt-1 flex items-center justify-between">
				<span class="text-[10px] text-gray-500">{commentLabel}</span>
				<i
					class="fa-solid fa-comments text-[10px] text-gray-400 opacity-0 transition-opacity group-hover/comment:opacity-100"
				></i>
			</div>
		</button>
	{/if}

	<!-- Annotation panel, under the message it codes -->
	{#if annotationOpen}
		<div class="annotation-panel-container mt-2 max-w-2xl px-4 sm:px-12">
			<MessageAnnotationPanel
				{projectId}
				{categories}
				{annotation}
				saving={savingAnnotation}
				onSave={onSaveAnnotation}
				onDelete={onDeleteAnnotation}
				onCancel={onCancelAnnotation}
				{onCategoryCreated}
			/>
		</div>
	{/if}

	{@render afterMessage?.()}

	<!-- Margin discussion, in the right margin on wide screens -->
	{#if hasMarginCard}
		<div class="absolute top-0 left-full ml-4 hidden w-80 pl-4 xl:block">
			<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
					<span class="text-xs font-medium text-gray-600">
						{commentCount > 0 ? commentLabel : 'Comments'}
					</span>
					{#if isCommentOpen}
						<button
							type="button"
							class="text-gray-400 hover:text-gray-600"
							aria-label="Close comments"
							onclick={() => surface.close(messageId)}
						>
							<i class="fa-solid fa-times text-xs"></i>
						</button>
					{:else}
						<button
							type="button"
							class="text-[10px] text-blue-600 hover:text-blue-800"
							onclick={() => surface.open(messageId)}
						>
							Reply
						</button>
					{/if}
				</div>
				<div class="p-3">
					{#if isCommentOpen}
						<MessageCommentThread
							comments={thread}
							{currentUserId}
							{canModerate}
							pending={comments.isPending(messageId)}
							compact
							autofocusComposer={commentCount === 0}
							onAdd={(body, parentId) => comments.add(messageId, body, parentId)}
							onEdit={(commentId, body) => comments.edit(messageId, commentId, body)}
							onDelete={(commentId) => comments.remove(messageId, commentId)}
						/>
					{:else}
						<button type="button" class="w-full text-left" onclick={() => surface.open(messageId)}>
							{#each thread.slice(0, 2) as root (root.id)}
								<p class="mb-1 line-clamp-3 text-sm text-gray-700">
									<span class="font-medium">{authorName(root.author)}:</span>
									{root.body}
								</p>
							{/each}
							{#if commentCount > 2}
								<span class="text-[10px] text-gray-400">Show whole thread</span>
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
