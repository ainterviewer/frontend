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
	import AnnotatedMessage from '$lib/components/analysis/AnnotatedMessage.svelte';
	import MessageCommentModal from '$lib/components/analysis/MessageCommentModal.svelte';
	import AudioPlayer from '$lib/components/interview/AudioPlayer.svelte';
	import type { Message } from '$lib/components/interview/types';
	import { CommentSurface } from '$lib/stores/commentSurface.svelte';
	import { MessageComments } from '$lib/stores/messageComments.svelte';
	import { SvelteMap } from 'svelte/reactivity';

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
	const surface = new CommentSurface();

	$effect(() => {
		surface.syncWidth();
	});

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
				Hover a message to annotate or comment on it
			</div>
		{/if}
	</header>

	<!-- Messages Area -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-4 xl:pr-[320px]" style="overflow-x: clip;">
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

						{#if msg.type === 'system'}
							<div class="my-2 text-center text-sm text-gray-500 select-none">{msg.text}</div>
						{:else}
							<AnnotatedMessage
								message={msg}
								{messageId}
								lang={data.lang}
								projectId={data.project_id}
								categories={data.categories}
								annotation={messageAnnotations.get(messageId)}
								otherAnnotations={otherAnnotations.get(messageId) ?? []}
								{comments}
								{surface}
								currentUserId={userId}
								{canModerate}
								canAnnotate={hasCategories}
								annotationOpen={activeAnnotationMessageId === messageId}
								{savingAnnotation}
								onToggleAnnotation={() =>
									(activeAnnotationMessageId =
										activeAnnotationMessageId === messageId ? null : messageId)}
								onSaveAnnotation={(values, shouldClose) =>
									handleSaveAnnotation(messageId, values, shouldClose)}
								onDeleteAnnotation={messageAnnotations.has(messageId)
									? () => handleDeleteAnnotation(messageId)
									: undefined}
								onCancelAnnotation={() => (activeAnnotationMessageId = null)}
								onCategoryCreated={() => invalidateAll()}
							>
								{#snippet underMessage()}
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
								{/snippet}
							</AnnotatedMessage>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Comment thread modal, where the screen has no room for a margin card -->
<MessageCommentModal {comments} {surface} currentUserId={userId} {canModerate} />

<svelte:window
	onresize={() => surface.syncWidth()}
	onkeydown={(e) => {
		// Escape closes whichever comment surface is open — the modal on narrow
		// screens, the margin threads on wide ones — wherever focus happens to
		// be. Unless the thread already used the key to back out of a reply or
		// edit box, which is the more local meaning of the same press.
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		surface.closeTopmost();
	}}
/>
