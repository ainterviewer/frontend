<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Analysis, type Image, type MessagePublic } from '$lib/api';
	import type {
		AnalysisCategoryPublic,
		AnnotationValueCreate,
		MessageAnnotationPublic
	} from '$lib/api/types.gen';
	import type { Message } from '../../../../../../../interview/chat.svelte';
	import InterviewMessage from '../../../../../../../interview/components/InterviewMessage.svelte';
	import { getContrastColor } from '$lib/utils/colors';
	import MessageAnnotationPanel from '$lib/components/analysis/MessageAnnotationPanel.svelte';
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	// State
	let projectId = $derived(page.params.project_id ?? '');
	let lang = $derived(page.params.lang ?? '');

	// Query params
	let categoryId = $derived(page.url.searchParams.get('category_id'));
	let searchTextParam = $derived(page.url.searchParams.get('search_text'));
	let exactMatchParam = $derived(page.url.searchParams.get('exact_match') === 'true');
	let caseSensitiveParam = $derived(page.url.searchParams.get('case_sensitive') === 'true');

	let categories = $state<AnalysisCategoryPublic[]>([]);
	let rawMessages = $state<MessagePublic[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// UI State
	let activeAnnotationMessageId = $state<string | null>(null);
	let savingAnnotation = $state(false);

	// Search State (local form state)
	let searchText = $state('');
	let exactMatch = $state(false);
	let caseSensitive = $state(false);
	let showSearchOptions = $state(false);

	// Sync form state with URL params
	$effect(() => {
		searchText = searchTextParam || '';
		exactMatch = exactMatchParam;
		caseSensitive = caseSensitiveParam;
	});

	// Derived State
	let currentCategory = $derived(
		categoryId ? categories.find((c) => c.id === categoryId) : null
	);

	// Map raw messages to UI messages and group by interview
	let groupedMessages = $derived.by(() => {
		if (rawMessages.length === 0) return [];

		// Sort by interview_id then message_id
		const sorted = [...rawMessages].sort((a, b) => {
			if (a.interview_id !== b.interview_id) {
				return a.interview_id.localeCompare(b.interview_id);
			}
			return a.message_id - b.message_id;
		});

		const groups: {
			interviewId: string;
			messages: (Message & { id: string; raw: MessagePublic })[];
		}[] = [];
		let currentGroup: {
			interviewId: string;
			messages: (Message & { id: string; raw: MessagePublic })[];
		} | null = null;

		for (const msg of sorted) {
			if (!currentGroup || currentGroup.interviewId !== msg.interview_id) {
				currentGroup = { interviewId: msg.interview_id, messages: [] };
				groups.push(currentGroup);
			}

			// Transform logic (copied from interview page)
			let type: 'sent' | 'received' | 'system' = 'system';
			if (msg.role === 'user') type = 'sent';
			else if (msg.role === 'assistant') type = 'received';

			let image: { data: string; alt?: string; primer?: string } | undefined = undefined;
			if (msg.image) {
				if (Array.isArray(msg.image)) {
					if (msg.image.length > 0) {
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

			let question_label: string | undefined = undefined;
			if (msg.section !== undefined && msg.section !== null) {
				question_label = `${msg.section + 1}`;
				if (msg.main_question !== undefined && msg.main_question !== null) {
					question_label += `.${msg.main_question + 1}`;
					if (msg.sub_question) {
						question_label += `.${msg.sub_question}`;
					}
				}
			}

			currentGroup.messages.push({
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
				required: false,
				raw: msg // Keep raw message for annotations
			});
		}

		return groups;
	});

	// Annotations Map
	let messageAnnotations = $state<Map<string, MessageAnnotationPublic>>(new Map());

	$effect(() => {
		const map = new Map<string, MessageAnnotationPublic>();
		for (const msg of rawMessages) {
			if (msg.annotations && msg.annotations.length > 0) {
				map.set(msg.id, msg.annotations[0]);
			}
		}
		messageAnnotations = map;
	});

	async function loadData() {
		if (!projectId) return;
		loading = true;
		error = null;
		try {
			const [catsRes, msgsRes] = await Promise.all([
				Analysis.getAnalysisCategories({ path: { project_id: projectId } }),
				Analysis.getFilteredMessages({
					path: { project_id: projectId },
					query: {
						category_id: categoryId || null,
						search_text: searchTextParam || null,
						exact_match: exactMatchParam || undefined,
						case_sensitive: caseSensitiveParam || undefined
					}
				})
			]);

			if (catsRes.data) categories = catsRes.data;
			if (msgsRes.data) rawMessages = msgsRes.data;
		} catch (e) {
			console.error('Failed to load data', e);
			error = 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (projectId) loadData();
	});

	// Handle search form submission
	function handleSearch(e: Event) {
		e.preventDefault();
		updateSearchParams();
	}

	function updateSearchParams() {
		const params = new URLSearchParams();
		if (categoryId) params.set('category_id', categoryId);
		if (searchText.trim()) {
			params.set('search_text', searchText.trim());
			if (exactMatch) params.set('exact_match', 'true');
			if (caseSensitive) params.set('case_sensitive', 'true');
		}
		goto(`?${params.toString()}`, { replaceState: false, keepFocus: true });
	}

	function clearSearch() {
		searchText = '';
		exactMatch = false;
		caseSensitive = false;
		const params = new URLSearchParams();
		if (categoryId) params.set('category_id', categoryId);
		goto(`?${params.toString()}`, { replaceState: false });
	}

	function clearCategoryFilter() {
		const params = new URLSearchParams();
		if (searchTextParam) {
			params.set('search_text', searchTextParam);
			if (exactMatchParam) params.set('exact_match', 'true');
			if (caseSensitiveParam) params.set('case_sensitive', 'true');
		}
		goto(`?${params.toString()}`, { replaceState: false });
	}

	// Annotation Helpers
	function getAnnotationSummary(annotation: MessageAnnotationPublic): {
		tags: { name: string; color: string }[];
		scores: { name: string; value: number; color: string }[];
		hasComment: boolean;
	} {
		const tags: { name: string; color: string }[] = [];
		const scores: { name: string; value: number; color: string }[] = [];

		for (const value of annotation.values) {
			const category = categories.find((c) => c.id === value.category_id);
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

	async function handleSaveAnnotation(
		messageId: string,
		values: AnnotationValueCreate[],
		comment: string | null,
		shouldClose: boolean = true
	) {
		const userId = page.data.user?.id;

		if (!userId) {
			alert('User not found. Please reload.');
			return;
		}

		savingAnnotation = true;
		try {
			const existingAnnotation = messageAnnotations.get(messageId);

			if (existingAnnotation) {
				const { data: updatedAnnotation, error } = await Analysis.updateMessageAnnotation({
					path: { annotation_id: existingAnnotation.id },
					body: {
						message_id: messageId,
						user_id: userId,
						comment,
						values
					}
				});
				if (error) throw error;
				if (updatedAnnotation) {
					const newMap = new Map(messageAnnotations);
					newMap.set(messageId, updatedAnnotation);
					messageAnnotations = newMap;
				}
			} else {
				const { data: newAnnotation, error } = await Analysis.addMessageAnnotation({
					path: { message_id: messageId },
					body: {
						message_id: messageId,
						user_id: userId,
						comment,
						values
					}
				});
				if (error) throw error;
				if (newAnnotation) {
					const newMap = new Map(messageAnnotations);
					newMap.set(messageId, newAnnotation);
					messageAnnotations = newMap;
				}
			}

			if (shouldClose) activeAnnotationMessageId = null;
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
			if (error) throw error;
			const newMap = new Map(messageAnnotations);
			newMap.delete(messageId);
			messageAnnotations = newMap;
			activeAnnotationMessageId = null;
			loadData();
		} catch (e) {
			console.error('Error deleting annotation:', e);
			alert('Error deleting annotation');
		} finally {
			savingAnnotation = false;
		}
	}
</script>

<div
	class="flex h-[calc(100vh-8.5rem)] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
>
	<!-- Header -->
	<header class="flex flex-col border-b">
		<div class="flex items-center justify-between px-6 py-4">
			<div class="flex items-center gap-4">
				<a
					href={resolve(`/dashboard/projects/${projectId}/${lang}/analysis/annotate`)}
					class="text-gray-500 transition-colors hover:text-gray-700"
					aria-label="Back to categories"
				>
					<i class="fa-solid fa-arrow-left text-lg"></i>
				</a>
				<div class="flex flex-col">
					<h1 class="text-xl font-semibold text-gray-800">
						{#if currentCategory}
							Messages with <span
								class="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium"
								style="background-color: {currentCategory.color}; color: {getContrastColor(
									currentCategory.color
								)}">{currentCategory.name}</span
							>
						{:else if searchTextParam}
							Search Results
						{:else}
							All Messages
						{/if}
					</h1>
				</div>
			</div>
		</div>

		<!-- Search Bar -->
		<div class="border-t bg-gray-50 px-6 py-3">
			<form onsubmit={handleSearch} class="flex flex-col gap-2">
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input
							type="text"
							bind:value={searchText}
							placeholder="Search messages..."
							class="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						></i>
					</div>
					<button
						type="submit"
						class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
					>
						Search
					</button>
					{#if searchTextParam}
						<button
							type="button"
							onclick={clearSearch}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
						>
							Clear
						</button>
					{/if}
					<button
						type="button"
						onclick={() => (showSearchOptions = !showSearchOptions)}
						class="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50"
						title="Search options"
					>
						<i class="fa-solid fa-sliders"></i>
					</button>
				</div>

				{#if showSearchOptions}
					<div class="flex gap-4 rounded-md bg-white p-3 text-sm">
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={exactMatch} class="rounded" />
							<span class="text-gray-700">Exact match</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={caseSensitive} class="rounded" />
							<span class="text-gray-700">Case sensitive</span>
						</label>
					</div>
				{/if}

				<!-- Active Filters -->
				{#if currentCategory || searchTextParam}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-gray-500">Active filters:</span>
						{#if currentCategory}
							<button
								type="button"
								onclick={clearCategoryFilter}
								class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
								style="background-color: {currentCategory.color}; color: {getContrastColor(
									currentCategory.color
								)}"
							>
								{currentCategory.name}
								<i class="fa-solid fa-times"></i>
							</button>
						{/if}
						{#if searchTextParam}
							<span class="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs">
								<i class="fa-solid fa-search"></i>
								"{searchTextParam}"
								{#if exactMatchParam}
									<span class="text-[10px]">(exact)</span>
								{/if}
								{#if caseSensitiveParam}
									<span class="text-[10px]">(case)</span>
								{/if}
							</span>
						{/if}
					</div>
				{/if}
			</form>
		</div>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-4">
		<div class="mx-auto min-h-full max-w-4xl space-y-6">
			{#if loading}
				<div class="flex justify-center py-8">
					<i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
				</div>
			{:else if error}
				<div class="rounded-md bg-red-50 p-4 text-center text-red-700">
					<p>{error}</p>
				</div>
			{:else if groupedMessages.length === 0}
				<div class="rounded-lg bg-white p-8 text-center shadow-sm">
					<i class="fa-regular fa-comments mb-3 text-3xl text-gray-400"></i>
					<p class="text-gray-500">
						{#if searchTextParam || currentCategory}
							No messages found matching your filters.
						{:else}
							No messages found.
						{/if}
					</p>
				</div>
			{:else}
				{#each groupedMessages as group (group.interviewId)}
					<div class="overflow-hidden rounded-lg bg-white shadow-sm">
						<!-- Interview Header -->
						<div
							class="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-3"
						>
							<h3 class="text-sm font-semibold text-gray-700">
								<i class="fa-solid fa-file-lines mr-2"></i>
								Interview {group.interviewId}
							</h3>
							<a
								href={resolve(
									`/dashboard/projects/${projectId}/${lang}/interviews/${group.interviewId}`
								)}
								class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
								target="_blank"
							>
								View Full Interview <i class="fa-solid fa-external-link-alt ml-1"></i>
							</a>
						</div>

						<div class="flex flex-col gap-4 p-4">
							{#each group.messages as msg (msg.id)}
								{@const messageId = msg.id}
								{@const annotation = messageAnnotations.get(messageId)}
								{@const annotationSummary = annotation ? getAnnotationSummary(annotation) : null}

								<div
									class={msg.type === 'system'
										? 'my-2 text-center text-sm text-gray-500'
										: 'group relative'}
								>
									{#if msg.type === 'system'}
										{msg.text}
									{:else}
										<div class="flex items-start gap-2">
											<div class="min-w-0 flex-1">
												<InterviewMessage
													message={msg}
													lang={lang || 'en'}
													isLast={false}
													readonly={true}
													onFeedback={() => {}}
													onSkip={() => {}}
													onSurveyAnswer={() => {}}
												/>

												<!-- Annotation Summary -->
												{#if annotationSummary && (annotationSummary.tags.length > 0 || annotationSummary.scores.length > 0 || annotationSummary.hasComment)}
													<div
														class="mt-1 flex flex-wrap items-center gap-1.5 {msg.type === 'received'
															? 'ml-[10px] sm:ml-[50px]'
															: 'mr-[10px] justify-end sm:mr-[50px]'}"
													>
														{#each annotationSummary.tags as tag}
															<span
																class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
																style="background-color: {tag.color}; color: {getContrastColor(
																	tag.color
																)}"
															>
																{tag.name}
															</span>
														{/each}
														{#each annotationSummary.scores as score}
															<span
																class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
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

											<!-- Edit Button -->
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
													title="Edit annotation"
												>
													<i class="fa-solid fa-pen-to-square text-xs"></i>
												</button>
											</div>
										</div>

										<!-- Annotation Panel -->
										{#if activeAnnotationMessageId === messageId}
											<div class="annotation-panel-container mt-2 max-w-2xl px-4 sm:px-12">
												<MessageAnnotationPanel
													{projectId}
													{categories}
													{annotation}
													saving={savingAnnotation}
													onSave={(values, comment, shouldClose) =>
														handleSaveAnnotation(messageId, values, comment, shouldClose)}
													onDelete={annotation
														? () => handleDeleteAnnotation(messageId)
														: undefined}
													onCancel={() => (activeAnnotationMessageId = null)}
													onCategoryCreated={() => loadData()}
												/>
											</div>
										{/if}
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<svelte:window
	onclick={(e) => {
		if (
			activeAnnotationMessageId &&
			!(e.target as Element).closest('.annotation-panel-container') &&
			!(e.target as Element).closest('button')
		) {
			// Optional: close on click outside
		}
	}}
/>
