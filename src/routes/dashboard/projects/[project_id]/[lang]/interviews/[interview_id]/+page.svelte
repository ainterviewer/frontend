<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Analysis, type Image, type MessagePublic } from '$lib/api';
	import type {
		AnalysisCategoryPublic,
		AnnotationValueCreate,
		MessageAnnotationPublic
	} from '$lib/api/types.gen';
	import type { Message } from '../../../../../../interview/chat.svelte';
	import InterviewMessage from '../../../../../../interview/components/InterviewMessage.svelte';
	import { getContrastColor } from '$lib/utils/colors';
	import MessageAnnotationPanel from '$lib/components/analysis/MessageAnnotationPanel.svelte';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State for annotations - keyed by message id
	let messageAnnotations = $state<Map<string, MessageAnnotationPublic>>(new Map());

	// Initialize annotations from server data
	$effect(() => {
		const annotationMap = new Map<string, MessageAnnotationPublic>();
		for (const msg of data.messages as MessagePublic[]) {
			if (msg.annotations && msg.annotations.length > 0) {
				// Use the first annotation (or could show all)
				annotationMap.set(msg.id, msg.annotations[0]);
			}
		}
		messageAnnotations = annotationMap;
	});

	// UI state
	let activeAnnotationMessageId = $state<string | null>(null);
	let savingAnnotation = $state(false);

	// Get user ID from the layout data
	let userId = $derived(page.data.user?.id || '');

	// Transform API messages to ChatClient Message format
	let messages = $derived.by(() => {
		if (!data.messages) return [];

		return (data.messages as MessagePublic[]).map((msg) => {
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
						if (img.data) {
							image = {
								data: img.data,
								alt: img.alt,
								primer: img.primer || undefined
							};
						}
					}
				} else {
					const img = msg.image as Image;
					if (img.data) {
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
				feedback: msg.feedback,
				survey_item: msg.survey_item,
				image: image,
				can_answer: msg.can_answer,
				user_image: false,
				question_label,
				section: msg.section,
				options: undefined,
				required: false
			} as Message & { id: string };
		});
	});

	// Get the original MessagePublic by id for annotation purposes
	function getMessagePublicById(id: string): MessagePublic | undefined {
		return (data.messages as MessagePublic[]).find((m) => m.id === id);
	}

	// Annotation handlers
	async function handleSaveAnnotation(
		messageId: string,
		values: AnnotationValueCreate[],
		comment: string | null,
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
						comment,
						values
					}
				});

				if (error) {
					console.error('Failed to update annotation:', error);
					alert('Failed to update annotation');
					return;
				}

				if (updatedAnnotation) {
					const newMap = new Map(messageAnnotations);
					newMap.set(messageId, updatedAnnotation);
					messageAnnotations = newMap;
				}
			} else {
				// Create new annotation
				const { data: newAnnotation, error } = await Analysis.addMessageAnnotation({
					path: { message_id: messageId },
					body: {
						message_id: messageId,
						user_id: userId,
						comment,
						values
					}
				});

				if (error) {
					console.error('Failed to add annotation:', error);
					alert('Failed to add annotation');
					return;
				}

				if (newAnnotation) {
					const newMap = new Map(messageAnnotations);
					newMap.set(messageId, newAnnotation);
					messageAnnotations = newMap;
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

			const newMap = new Map(messageAnnotations);
			newMap.delete(messageId);
			messageAnnotations = newMap;
			activeAnnotationMessageId = null;
		} catch (e) {
			console.error('Error deleting annotation:', e);
			alert('Error deleting annotation');
		} finally {
			savingAnnotation = false;
		}
	}

	function getAnnotationSummary(annotation: MessageAnnotationPublic): {
		tags: { name: string; color: string }[];
		scores: { name: string; value: number; color: string }[];
		hasComment: boolean;
	} {
		const tags: { name: string; color: string }[] = [];
		const scores: { name: string; value: number; color: string }[] = [];

		for (const value of annotation.values) {
			const category = (data.categories as AnalysisCategoryPublic[]).find(
				(c) => c.id === value.category_id
			);
			if (category) {
				if (category.type === 'tag' && value.value_int === 1) {
					tags.push({ name: category.name, color: category.color });
				} else if (category.type === 'score') {
					scores.push({ name: category.name, value: value.value_int, color: category.color });
				}
			}
		}

		return { tags, scores, hasComment: !!annotation.comment };
	}

	let hasCategories = $derived((data.categories as AnalysisCategoryPublic[])?.length > 0);
</script>

<div
	class="flex h-[calc(100vh-8.5rem)] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
>
	<!-- Header -->
	<header class="flex items-center justify-between border-b px-6 py-4">
		<div class="flex items-center gap-4">
			<a
				href={resolve(`/dashboard/projects/${data.project_id}/${data.lang}/interviews`)}
				class="text-gray-500 transition-colors hover:text-gray-700"
				aria-label="Back to interviews"
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
						{@const annotationSummary = annotation ? getAnnotationSummary(annotation) : null}

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

										<!-- Annotation Summary (shown below message) -->
										{#if annotationSummary && (annotationSummary.tags.length > 0 || annotationSummary.scores.length > 0 || annotationSummary.hasComment)}
											<div
												class="mt-1 flex flex-wrap items-center gap-1.5 {msg.type === 'received'
													? 'ml-2.5 sm:ml-[50px]'
													: 'mr-2.5 justify-end sm:mr-[50px]'}"
											>
												{#each annotationSummary.tags as tag}
													<span
														class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
														style="background-color: {tag.color}; color: {getContrastColor(
															tag.color
														)}"
													>
														{tag.name}
													</span>
												{/each}
												{#each annotationSummary.scores as score}
													<span
														class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
														style="background-color: {score.color}; color: {getContrastColor(
															score.color
														)}"
													>
														{score.name}: {score.value}
													</span>
												{/each}
												{#if annotationSummary.hasComment}
													<HoverInfo text={annotation?.comment || ''} asChild>
														{#snippet children({ props })}
															<span
																{...props}
																class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
															>
																<i class="fa-solid fa-comment mr-1"></i>
																Note
															</span>
														{/snippet}
													</HoverInfo>
												{/if}
											</div>
										{/if}
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

							<!-- Annotation Panel (inline) -->
							{#if activeAnnotationMessageId === messageId}
								<div class="annotation-panel-container mt-2 max-w-2xl px-4 sm:px-12">
									<MessageAnnotationPanel
										projectId={data.project_id}
										categories={data.categories as AnalysisCategoryPublic[]}
										{annotation}
										saving={savingAnnotation}
										onSave={(values, comment, shouldClose) =>
											handleSaveAnnotation(messageId, values, comment, shouldClose)}
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
