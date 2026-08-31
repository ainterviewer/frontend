<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Analysis, type Image, type MessagePublic } from '$lib/api';
	import type {
		AnalysisCategoryPublic,
		AnnotationValueCreate,
		MessageAnnotationPublic
	} from '$lib/api/types.gen';
	import AnnotationChips from '$lib/components/analysis/AnnotationChips.svelte';
	import MessageAnnotationPanel from '$lib/components/analysis/MessageAnnotationPanel.svelte';
	import MessageCommentThread from '$lib/components/analysis/MessageCommentThread.svelte';
	import AudioPlayer from '$lib/components/interview/AudioPlayer.svelte';
	import InterviewMessage from '$lib/components/interview/InterviewMessage.svelte';
	import type { Message } from '$lib/components/interview/types';
	import { MessageComments } from '$lib/stores/messageComments.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface InterviewData {
		messages: MessagePublic[];
		categories: AnalysisCategoryPublic[];
		project_id: string;
		lang: string;
		interview_id: string;
		error: string | null;
	}

	let {
		data,
		backLink
	}: {
		data: InterviewData;
		backLink: string;
	} = $props();

	// Get user ID from the layout data
	let userId = $derived(page.data.user?.id || '');
	// Moderation (editing or deleting someone else's comment) is the project's
	// to grant: platform admin, project owner, or folder admin. The server says
	// which, so the buttons match what the API will actually accept.
	let canModerate = $derived(page.data.permissions?.can_moderate ?? false);

	// Annotations are per author: the current user's is the editable one, the
	// others are shown read-only. Comments are a separate, threaded discussion.
	const messageAnnotations = new SvelteMap<string, MessageAnnotationPublic>();
	const otherAnnotations = new SvelteMap<string, MessageAnnotationPublic[]>();
	const comments = new MessageComments();

	// Initialize annotations and comment threads from server data
	$effect(() => {
		messageAnnotations.clear();
		otherAnnotations.clear();
		comments.clear();
		if (data.messages) {
			for (const msg of data.messages) {
				const own = msg.annotations?.find((annotation) => annotation.user_id === userId);
				if (own) messageAnnotations.set(msg.id, own);

				const others = msg.annotations?.filter((annotation) => annotation.user_id !== userId) ?? [];
				if (others.length > 0) otherAnnotations.set(msg.id, others);
			}
			comments.seed(data.messages);
		}
	});

	// UI state
	let activeAnnotationMessageId = $state<string | null>(null);
	let savingAnnotation = $state(false);
	/** Messages whose discussion thread is expanded. */
	const openCommentIds = new SvelteSet<string>();

	// Transform API messages to ChatClient Message format
	let messages = $derived.by(() => {
		if (!data.messages) return [];

		const transformed = data.messages.map((msg) => {
			// Determine message type based on role
			let type: 'sent' | 'received' | 'system' = 'system';
			if (msg.role === 'user') type = 'sent';
			else if (msg.role === 'assistant') type = 'received';

			// Handle image
			let image: { data: string; alt?: string; primer?: string } | undefined = undefined;
			if (msg.image) {
				if (Array.isArray(msg.image)) {
					if (msg.image.length > 0) {
						// Assuming first image if array
						const img = msg.image[0];
						if (typeof img.data === 'string') {
							image = {
								data: img.data,
								alt: img.alt,
								primer: img.primer || undefined
							};
						}
					}
				} else {
					const img = msg.image as Image;
					if (typeof img.data === 'string') {
						image = {
							data: img.data,
							alt: img.alt,
							primer: img.primer || undefined
						};
					}
				}
			}

			// Construct question label
			let question_label: string | undefined = undefined;
			if (msg.section !== undefined && msg.section !== null) {
				question_label = `${msg.section + 1}`;
				if (msg.main_question !== undefined && msg.main_question !== null) {
					question_label += `.${msg.main_question + 1}`;
					// sub_question = 0 means main question, sub_question > 0 means probe
					if (msg.sub_question) {
						question_label += `.${msg.sub_question}`;
					}
				}
			}

			return {
				id: msg.id,
				text: msg.content,
				type,
				message_id: msg.message_id,
				skipped_by_condition: msg.skipped_by_condition,
				feedback: msg.feedback,
				survey_item: msg.survey_item,
				image: image,
				can_answer: msg.can_answer,
				user_image: false,
				audio_file: msg.audio_file,
				question_label,
				section: msg.section,
				options: undefined,
				required: false
			} as Message & { id: string };
		});

		// In the transcript, survey items belong to the user's answer bubble:
		// move survey_item from the assistant question onto the following user message.
		let pendingSurvey: Message['survey_item'] | null = null;
		return transformed.map((m) => {
			if (m.type === 'received' && m.survey_item) {
				pendingSurvey = m.survey_item;
				return { ...m, survey_item: undefined };
			}
			if (m.type === 'sent' && pendingSurvey) {
				const withSurvey = {
					...m,
					survey_item: pendingSurvey,
					answer: m.text,
					text: undefined
				};
				pendingSurvey = null;
				return withSurvey;
			}
			return m;
		});
	});

	// Annotation handlers
	async function handleSaveAnnotation(
		messageId: string,
		values: AnnotationValueCreate[],
		shouldClose: boolean = true
	) {
		if (!userId) {
			console.error('No user ID available');
			return;
		}

		savingAnnotation = true;
		try {
			const existingAnnotation = messageAnnotations.get(messageId);

			if (existingAnnotation) {
				// Update existing annotation
				const { data: updatedAnnotation, error } = await Analysis.updateMessageAnnotation({
					path: { annotation_id: existingAnnotation.id },
					body: {
						message_id: messageId,
						user_id: userId,
						values
					}
				});

				if (error) {
					console.error('Failed to update annotation:', error);
					alert('Failed to update annotation');
					return;
				}

				if (updatedAnnotation) {
					messageAnnotations.set(messageId, updatedAnnotation);
				}
			} else {
				// Create new annotation
				const { data: newAnnotation, error } = await Analysis.addMessageAnnotation({
					path: { message_id: messageId },
					body: {
						message_id: messageId,
						user_id: userId,
						values
					}
				});

				if (error) {
					console.error('Failed to add annotation:', error);
					alert('Failed to add annotation');
					return;
				}

				if (newAnnotation) {
					messageAnnotations.set(messageId, newAnnotation);
				}
			}

			if (shouldClose) {
				activeAnnotationMessageId = null;
			}
		} catch (e) {
			console.error('Error saving annotation:', e);
			alert('Error saving annotation');
		} finally {
			savingAnnotation = false;
		}
	}

	async function handleDeleteAnnotation(messageId: string) {
		const annotation = messageAnnotations.get(messageId);
		if (!annotation) return;

		if (!confirm('Are you sure you want to delete this annotation?')) return;

		savingAnnotation = true;
		try {
			const { error } = await Analysis.deleteMessageAnnotation({
				path: { annotation_id: annotation.id }
			});

			if (error) {
				console.error('Failed to delete annotation:', error);
				alert('Failed to delete annotation');
				return;
			}

			messageAnnotations.delete(messageId);
			activeAnnotationMessageId = null;
		} catch (e) {
			console.error('Error deleting annotation:', e);
			alert('Error deleting annotation');
		} finally {
			savingAnnotation = false;
		}
	}

	let hasCategories = $derived(data.categories?.length > 0);
</script>

<div
	class="flex h-[calc(100vh-8.5rem)] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
>
	<!-- Header -->
	<header class="flex items-center justify-between border-b px-6 py-4">
		<div class="flex items-center gap-4">
			<a
				href={resolve(backLink as '/')}
				class="text-gray-500 transition-colors hover:text-gray-700"
				aria-label="Back"
			>
				<i class="fa-solid fa-arrow-left text-lg"></i>
			</a>
			<div class="flex flex-col">
				<h1 class="text-xl font-semibold text-gray-800">Interview Transcript</h1>
				<span class="text-sm text-gray-500">ID: {data.interview_id}</span>
			</div>
		</div>
		{#if hasCategories}
			<div class="text-xs text-gray-500">
				<i class="fa-solid fa-tags mr-1"></i>
				Click <i class="fa-solid fa-plus-circle mx-1"></i> to annotate messages
			</div>
		{/if}
	</header>

	<!-- Messages Area -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-4">
		<div class="mx-auto min-h-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
			{#if data.error}
				<div class="rounded-md bg-red-50 p-4 text-center text-red-700">
					<p>{data.error}</p>
				</div>
			{:else if messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-gray-500">
					<i class="fa-regular fa-comments mb-3 text-3xl"></i>
					<p>No messages found for this interview.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					{#each messages as msg, i (msg.message_id || msg.id)}
						{@const messageId = msg.id as string}
						{@const annotation = messageAnnotations.get(messageId)}
						{@const others = otherAnnotations.get(messageId) ?? []}
						{@const commentCount = comments.count(messageId)}
						{@const isCommentOpen = openCommentIds.has(messageId)}

						{#if msg.section !== undefined && msg.section !== null && (i === 0 || messages[i - 1].section !== msg.section)}
							<div class="relative my-6 flex items-center">
								<div class="flex-grow border-t border-gray-200"></div>
								<span
									class="mx-4 flex-shrink text-xs font-bold tracking-widest text-gray-400 uppercase"
								>
									Section {msg.section + 1}
								</span>
								<div class="flex-grow border-t border-gray-200"></div>
							</div>
						{/if}

						<div
							class={msg.type === 'system'
								? 'my-2 text-center text-sm text-gray-500 select-none'
								: 'group relative'}
						>
							{#if msg.type === 'system'}
								{msg.text}
							{:else}
								<div class="flex items-start gap-2">
									<!-- Message Content -->
									<div class="min-w-0 flex-1">
										<InterviewMessage
											message={msg}
											lang={data.lang}
											isLast={false}
											readonly={true}
											onFeedback={() => {}}
											onSkip={() => {}}
											onSurveyAnswer={() => {}}
										/>

										<!-- Original voice recording of a transcribed message -->
										{#if msg.audio_file}
											<div
												class="mt-1 flex {msg.type === 'received'
													? 'ml-2.5 sm:ml-[50px]'
													: 'mr-2.5 justify-end sm:mr-[50px]'}"
											>
												<AudioPlayer
													src="/api/projects/{data.project_id}/interviews/{data.interview_id}/audio/{msg.audio_file}"
												/>
											</div>
										{/if}

										<!-- Annotation summary (shown below message) -->
										{#if annotation || others.length > 0}
											<div
												class="mt-1 flex flex-wrap items-center gap-1.5 {msg.type === 'received'
													? 'ml-2.5 sm:ml-[50px]'
													: 'mr-2.5 justify-end sm:mr-[50px]'}"
											>
												{#if annotation}
													<AnnotationChips {annotation} categories={data.categories} />
												{/if}
												{#each others as other (other.id)}
													<AnnotationChips
														annotation={other}
														categories={data.categories}
														showAuthor
													/>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Comment Button -->
									<div class="flex-shrink-0 self-start pt-2">
										<button
											type="button"
											class="flex h-7 items-center justify-center gap-1 rounded-full px-2 transition-all {commentCount >
											0
												? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
												: 'w-7 bg-gray-100 px-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600'}"
											onclick={() =>
												isCommentOpen
													? openCommentIds.delete(messageId)
													: openCommentIds.add(messageId)}
											title={commentCount > 0
												? `${commentCount} comment${commentCount === 1 ? '' : 's'}`
												: 'Add comment'}
										>
											<i class="fa-solid fa-comment text-xs"></i>
											{#if commentCount > 0}
												<span class="text-[10px] font-medium">{commentCount}</span>
											{/if}
										</button>
									</div>

									<!-- Annotation Button -->
									{#if hasCategories}
										<div class="relative flex-shrink-0 self-start pt-2">
											<button
												type="button"
												class="flex h-7 w-7 items-center justify-center rounded-full transition-all {annotation
													? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
													: 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600'}"
												onclick={() => {
													activeAnnotationMessageId =
														activeAnnotationMessageId === messageId ? null : messageId;
												}}
												title={annotation ? 'Edit annotation' : 'Add annotation'}
											>
												{#if annotation}
													<i class="fa-solid fa-pen-to-square text-xs"></i>
												{:else}
													<i class="fa-solid fa-plus text-xs"></i>
												{/if}
											</button>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Discussion thread (inline) -->
							{#if isCommentOpen}
								<div class="mt-2 max-w-2xl px-4 sm:px-12">
									<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
										<MessageCommentThread
											comments={comments.get(messageId)}
											currentUserId={userId}
											{canModerate}
											pending={comments.isPending(messageId)}
											autofocusComposer={commentCount === 0}
											onAdd={(body, parentId) => comments.add(messageId, body, parentId)}
											onEdit={(commentId, body) => comments.edit(messageId, commentId, body)}
											onDelete={(commentId) => comments.remove(messageId, commentId)}
										/>
									</div>
								</div>
							{/if}

							<!-- Annotation Panel (inline) -->
							{#if activeAnnotationMessageId === messageId}
								<div class="annotation-panel-container mt-2 max-w-2xl px-4 sm:px-12">
									<MessageAnnotationPanel
										projectId={data.project_id}
										categories={data.categories}
										{annotation}
										saving={savingAnnotation}
										onSave={(values, shouldClose) =>
											handleSaveAnnotation(messageId, values, shouldClose)}
										onDelete={annotation ? () => handleDeleteAnnotation(messageId) : undefined}
										onCancel={() => (activeAnnotationMessageId = null)}
										onCategoryCreated={() => invalidateAll()}
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Click outside to close annotation panel -->
<svelte:window
	onclick={(e) => {
		if (
			activeAnnotationMessageId &&
			!(e.target as Element).closest('.annotation-panel-container') &&
			!(e.target as Element).closest('button')
		) {
			// Don't close immediately to allow panel interactions
		}
	}}
/>
