<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Analysis, Projects, type Image, type MessagePublic } from '$lib/api';
	import type {
		AnalysisCategoryPublic,
		AnnotationValueCreate,
		MessageAnnotationPublic,
		InterviewGuideOutput
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
	let categoryIdsParam = $derived(page.url.searchParams.getAll('category_id'));
	let searchTextParam = $derived(page.url.searchParams.get('search_text'));
	let exactMatchParam = $derived(page.url.searchParams.get('exact_match') === 'true');
	let caseSensitiveParam = $derived(page.url.searchParams.get('case_sensitive') === 'true');
	let questionsParam = $derived(
		page.url.searchParams
			.getAll('question')
			.map((q) => {
				const parts = q.split(',').map(Number);
				if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
					return [parts[0], parts[1]] as [number, number];
				}
				return null;
			})
			.filter((q): q is [number, number] => q !== null)
	);

	let categories = $state<AnalysisCategoryPublic[]>([]);
	let guide = $state<InterviewGuideOutput | null>(null);
	let rawMessages = $state<MessagePublic[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// UI State
	let activeAnnotationMessageId = $state<string | null>(null);
	let savingAnnotation = $state(false);
	let showQuestionDropdown = $state(false);

	// Search State (local form state)
	let searchText = $state('');
	let exactMatch = $state(false);
	let caseSensitive = $state(false);
	let showSearchOptions = $state(false);
	let selectedCategoryIds = $state<string[]>([]);
	let selectedQuestions = $state<[number, number][]>([]);

	// Per-message context state (consolidated)
	let messageContext = $state<{
		before: Map<string, MessagePublic[]>;
		after: Map<string, MessagePublic[]>;
		loadingBefore: Set<string>;
		loadingAfter: Set<string>;
	}>({
		before: new Map(),
		after: new Map(),
		loadingBefore: new Set(),
		loadingAfter: new Set()
	});

	// Helper to prevent default and stop propagation
	function stopEvent(e: Event) {
		e.preventDefault();
		e.stopPropagation();
	}

	// Transform raw message to UI message format
	function transformToUIMessage(msg: MessagePublic): Message & { id: string; raw: MessagePublic } {
		let type: 'sent' | 'received' | 'system' = 'system';
		if (msg.role === 'user') type = 'sent';
		else if (msg.role === 'assistant') type = 'received';

		let image: { data: string; alt?: string; primer?: string } | undefined;
		if (msg.image) {
			const imgSource = Array.isArray(msg.image) ? msg.image[0] : (msg.image as Image);
			if (imgSource?.data) {
				image = {
					data: imgSource.data,
					alt: imgSource.alt,
					primer: imgSource.primer || undefined
				};
			}
		}

		let question_label: string | undefined;
		if (msg.section !== undefined && msg.section !== null) {
			question_label = `${msg.section + 1}`;
			if (msg.main_question !== undefined && msg.main_question !== null) {
				question_label += `.${msg.main_question + 1}`;
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
			image,
			can_answer: msg.can_answer,
			user_image: false,
			question_label,
			section: msg.section,
			options: undefined,
			required: false,
			raw: msg
		};
	}

	// Sync form state with URL params
	$effect(() => {
		searchText = searchTextParam || '';
		exactMatch = exactMatchParam;
		caseSensitive = caseSensitiveParam;
		selectedCategoryIds = categoryIdsParam;
		selectedQuestions = questionsParam;
	});

	// Derived State
	let selectedCategories = $derived(categories.filter((c) => selectedCategoryIds.includes(c.id)));

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
		let currentGroup: (typeof groups)[number] | null = null;

		for (const msg of sorted) {
			if (!currentGroup || currentGroup.interviewId !== msg.interview_id) {
				currentGroup = { interviewId: msg.interview_id, messages: [] };
				groups.push(currentGroup);
			}
			currentGroup.messages.push(transformToUIMessage(msg));
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
			const [catsRes, guideRes, msgsRes] = await Promise.all([
				Analysis.getAnalysisCategories({ path: { project_id: projectId } }),
				Projects.getGuide({ path: { project_id: projectId, lang: lang } }).catch((err) => {
					console.warn('Failed to load guide:', err);
					return { data: null };
				}),
				Analysis.getFilteredMessages({
					path: { project_id: projectId },
					body: {
						category_ids: categoryIdsParam.length > 0 ? categoryIdsParam : null,
						search_text: searchTextParam || null,
						exact_match: exactMatchParam || undefined,
						case_sensitive: caseSensitiveParam || undefined,
						questions: questionsParam.length > 0 ? questionsParam : null
					}
				})
			]);

			if (catsRes.data) categories = catsRes.data;
			if (guideRes.data) guide = guideRes.data;
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
		selectedCategoryIds.forEach((id) => params.append('category_id', id));
		selectedQuestions.forEach(([section, question]) =>
			params.append('question', `${section},${question}`)
		);
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
		selectedCategoryIds.forEach((id) => params.append('category_id', id));
		selectedQuestions.forEach(([section, question]) =>
			params.append('question', `${section},${question}`)
		);
		goto(`?${params.toString()}`, { replaceState: false });
	}

	function toggleCategoryFilter(categoryId: string) {
		if (selectedCategoryIds.includes(categoryId)) {
			selectedCategoryIds = selectedCategoryIds.filter((id) => id !== categoryId);
		} else {
			selectedCategoryIds = [...selectedCategoryIds, categoryId];
		}
		updateSearchParams();
	}

	function addCategoryFilter(categoryId: string) {
		selectedCategoryIds = [...selectedCategoryIds, categoryId];
		updateSearchParams();
	}

	function removeCategoryFilter(categoryId: string) {
		selectedCategoryIds = selectedCategoryIds.filter((id) => id !== categoryId);
		updateSearchParams();
	}

	function clearAllCategoryFilters() {
		selectedCategoryIds = [];
		updateSearchParams();
	}

	function addQuestionFilter(section: number, question: number) {
		if (!selectedQuestions.some(([s, q]) => s === section && q === question)) {
			selectedQuestions = [...selectedQuestions, [section, question]];
			updateSearchParams();
		}
	}

	function removeQuestionFilter(section: number, question: number) {
		selectedQuestions = selectedQuestions.filter(([s, q]) => !(s === section && q === question));
		updateSearchParams();
	}

	function clearAllQuestionFilters() {
		selectedQuestions = [];
		updateSearchParams();
	}

	function getQuestionLabel(section: number, question: number): string {
		return `${section + 1}.${question + 1}`;
	}

	function getQuestionText(section: number, question: number): string {
		if (!guide?.question_sections) return '';
		const sectionData = guide.question_sections[section];
		if (!sectionData?.questions) return '';
		const questionData = sectionData.questions[question];
		return questionData?.main_question || '';
	}

	function getSectionDescription(section: number): string {
		if (!guide?.question_sections) return '';
		const sectionData = guide.question_sections[section];
		return sectionData?.description || '';
	}

	function isSectionFullySelected(sectionIdx: number): boolean {
		if (!guide?.question_sections) return false;
		const section = guide.question_sections[sectionIdx];
		if (!section?.questions) return false;
		return section.questions.every((_, qIdx) =>
			selectedQuestions.some(([s, q]) => s === sectionIdx && q === qIdx)
		);
	}

	function toggleSection(sectionIdx: number) {
		if (!guide?.question_sections) return;
		const section = guide.question_sections[sectionIdx];
		if (!section?.questions) return;

		const isFullySelected = isSectionFullySelected(sectionIdx);

		if (isFullySelected) {
			// Remove all questions from this section
			selectedQuestions = selectedQuestions.filter(([s]) => s !== sectionIdx);
		} else {
			// Add all questions from this section that aren't already selected
			const questionsToAdd = section.questions
				.map((_, qIdx) => [sectionIdx, qIdx] as [number, number])
				.filter(([s, q]) => !selectedQuestions.some(([ss, qq]) => ss === s && qq === q));
			selectedQuestions = [...selectedQuestions, ...questionsToAdd];
		}
		updateSearchParams();
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

	async function fetchContextBefore(messageId: string, interviewId: string) {
		if (messageContext.before.has(messageId)) {
			const newMap = new Map(messageContext.before);
			newMap.delete(messageId);
			messageContext = { ...messageContext, before: newMap };
			return;
		}

		const newLoading = new Set(messageContext.loadingBefore);
		newLoading.add(messageId);
		messageContext = { ...messageContext, loadingBefore: newLoading };

		try {
			const response = await Analysis.getMessageContextBefore({
				path: { project_id: projectId, interview_id: interviewId, message_id: messageId }
			});

			if (response.data) {
				const newMap = new Map(messageContext.before);
				newMap.set(messageId, response.data);
				messageContext = { ...messageContext, before: newMap };
			}
		} catch (e) {
			console.error('Error fetching context before:', e);
		} finally {
			const newLoading = new Set(messageContext.loadingBefore);
			newLoading.delete(messageId);
			messageContext = { ...messageContext, loadingBefore: newLoading };
		}
	}

	async function fetchContextAfter(messageId: string, interviewId: string) {
		if (messageContext.after.has(messageId)) {
			const newMap = new Map(messageContext.after);
			newMap.delete(messageId);
			messageContext = { ...messageContext, after: newMap };
			return;
		}

		const newLoading = new Set(messageContext.loadingAfter);
		newLoading.add(messageId);
		messageContext = { ...messageContext, loadingAfter: newLoading };

		try {
			const response = await Analysis.getMessageContextAfter({
				path: { project_id: projectId, interview_id: interviewId, message_id: messageId }
			});

			if (response.data) {
				const newMap = new Map(messageContext.after);
				newMap.set(messageId, response.data);
				messageContext = { ...messageContext, after: newMap };
			}
		} catch (e) {
			console.error('Error fetching context after:', e);
		} finally {
			const newLoading = new Set(messageContext.loadingAfter);
			newLoading.delete(messageId);
			messageContext = { ...messageContext, loadingAfter: newLoading };
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
						{#if selectedCategories.length > 0 || selectedQuestions.length > 0}
							Filtered Messages
							{#if selectedCategories.length > 0}
								({selectedCategories.length}
								{selectedCategories.length === 1 ? 'category' : 'categories'}
								{#if selectedQuestions.length > 0},
								{/if})
							{/if}
							{#if selectedQuestions.length > 0}
								({selectedQuestions.length}
								{selectedQuestions.length === 1 ? 'question' : 'questions'})
							{/if}
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
							class="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
						<i class="fa-solid fa-search absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
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
							onclick={(e) => {
								stopEvent(e);
								clearSearch();
							}}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
						>
							Clear
						</button>
					{/if}
					<div class="relative">
						<button
							type="button"
							onclick={(e) => {
								stopEvent(e);
								showQuestionDropdown = !showQuestionDropdown;
							}}
							class="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50"
							title="Add question filter"
						>
							<i class="fa-solid fa-list-ol mr-1"></i>
							Questions
							{#if selectedQuestions.length > 0}
								<span class="ml-1 text-xs">({selectedQuestions.length})</span>
							{/if}
						</button>
						{#if showQuestionDropdown}
							<div
								class="absolute right-0 z-10 mt-2 max-h-96 w-96 overflow-y-auto rounded-md bg-white shadow-lg"
							>
								{#if guide?.question_sections && guide.question_sections.length > 0}
									<div class="py-1">
										{#each guide.question_sections as section, sectionIdx}
											{#if section.questions && section.questions.length > 0}
												{@const isFullySelected = isSectionFullySelected(sectionIdx)}
												<div class="border-b border-gray-100">
													<!-- Section Header (clickable to select all) -->
													<button
														type="button"
														onclick={(e) => {
															stopEvent(e);
															toggleSection(sectionIdx);
														}}
														class="flex w-full items-center gap-2 bg-gray-50 px-4 py-2 text-left transition-colors hover:bg-gray-100"
													>
														<input
															type="checkbox"
															checked={isFullySelected}
															class="pointer-events-none rounded"
															readonly
														/>
														<span class="text-xs font-semibold text-gray-700">
															Section {sectionIdx + 1}
															{#if section.description}
																<span class="font-normal text-gray-500">
																	- {section.description.length > 40
																		? section.description.substring(0, 40) + '...'
																		: section.description}
																</span>
															{/if}
														</span>
													</button>
													<!-- Individual Questions -->
													<div class="px-4 py-2">
														<div class="space-y-1">
															{#each section.questions as question, questionIdx}
																{@const isSelected = selectedQuestions.some(
																	([s, q]) => s === sectionIdx && q === questionIdx
																)}
																<button
																	type="button"
																	onclick={(e) => {
																		stopEvent(e);
																		isSelected
																			? removeQuestionFilter(sectionIdx, questionIdx)
																			: addQuestionFilter(sectionIdx, questionIdx);
																	}}
																	class="flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition-colors hover:bg-gray-100 {isSelected
																		? 'bg-blue-50'
																		: ''}"
																>
																	<input
																		type="checkbox"
																		checked={isSelected}
																		class="pointer-events-none rounded"
																		readonly
																	/>
																	<span class="font-medium text-gray-600">
																		{sectionIdx + 1}.{questionIdx + 1}
																	</span>
																	<span class="flex-1 text-gray-700">
																		{question.main_question.length > 60
																			? question.main_question.substring(0, 60) + '...'
																			: question.main_question}
																	</span>
																</button>
															{/each}
														</div>
													</div>
												</div>
											{/if}
										{/each}
									</div>
								{:else}
									<div class="px-4 py-3 text-sm text-gray-500">
										{loading ? 'Loading questions...' : 'No questions available'}
									</div>
								{/if}
							</div>
						{/if}
					</div>
					<button
						type="button"
						onclick={(e) => {
							stopEvent(e);
							showSearchOptions = !showSearchOptions;
						}}
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

				<!-- Category Badges -->
				{#if categories.length > 0}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-gray-500">Categories:</span>
						{#each categories as category}
							{@const isSelected = selectedCategoryIds.includes(category.id)}
							<button
								type="button"
								onclick={(e) => {
									stopEvent(e);
									toggleCategoryFilter(category.id);
								}}
								class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all {isSelected
									? 'ring-2 ring-offset-1'
									: 'opacity-60 hover:opacity-100'}"
								style="background-color: {category.color}; color: {getContrastColor(
									category.color
								)}; {isSelected ? `ring-color: ${category.color}` : ''}"
							>
								{#if isSelected}
									<i class="fa-solid fa-check text-[10px]"></i>
								{/if}
								{category.name}
								<span class="text-[10px] opacity-75">({category.type})</span>
							</button>
						{/each}
						{#if selectedCategoryIds.length > 0}
							<button
								type="button"
								onclick={(e) => {
									stopEvent(e);
									clearAllCategoryFilters();
								}}
								class="text-xs text-gray-500 hover:text-gray-700 hover:underline"
							>
								Clear
							</button>
						{/if}
					</div>
				{/if}

				<!-- Active Filters -->
				{#if selectedQuestions.length > 0 || searchTextParam}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-gray-500">Active filters:</span>
						{#if selectedQuestions.length > 0}
							{#each selectedQuestions as [section, question]}
								{@const questionText = getQuestionText(section, question)}
								{@const sectionDesc = getSectionDescription(section)}
								<button
									type="button"
									onclick={() => removeQuestionFilter(section, question)}
									class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 transition-opacity hover:opacity-80"
									title="{sectionDesc
										? `Section ${section + 1}: ${sectionDesc}\n`
										: ''}Q {getQuestionLabel(section, question)}: {questionText}"
								>
									Q {getQuestionLabel(section, question)}
									<i class="fa-solid fa-times"></i>
								</button>
							{/each}
							{#if selectedQuestions.length > 1}
								<button
									type="button"
									onclick={clearAllQuestionFilters}
									class="text-xs text-blue-600 hover:underline"
								>
									Clear all questions
								</button>
							{/if}
						{/if}
						{#if searchTextParam}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs"
							>
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
						{#if searchTextParam || selectedCategories.length > 0}
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
							{#each group.messages as msg, msgIndex (msg.id)}
								{@const messageId = msg.id}
								{@const annotation = messageAnnotations.get(messageId)}
								{@const annotationSummary = annotation ? getAnnotationSummary(annotation) : null}
								{@const prevMsg = msgIndex > 0 ? group.messages[msgIndex - 1] : null}
								{@const nextMsg = msgIndex < group.messages.length - 1 ? group.messages[msgIndex + 1] : null}
								{@const hasImmediateSiblingBefore = prevMsg !== null && prevMsg.raw.message_id === msg.raw.message_id - 1}
								{@const hasImmediateSiblingAfter = nextMsg !== null && nextMsg.raw.message_id === msg.raw.message_id + 1}

								<div
									class={msg.type === 'system'
										? 'my-2 text-center text-sm text-gray-500'
										: 'group relative'}
								>
									{#if msg.type === 'system'}
										{msg.text}
									{:else}
										{@const isMainQuestion =
											msg.raw.sub_question === null || msg.raw.sub_question === 0}
										{@const hasContextBefore = messageContext.before.has(messageId)}
										{@const hasContextAfter = messageContext.after.has(messageId)}
										{@const isLoadingBefore = messageContext.loadingBefore.has(messageId)}
										{@const isLoadingAfter = messageContext.loadingAfter.has(messageId)}

										<!-- Context Before Button -->
										{#if !hasImmediateSiblingBefore && (!isMainQuestion || msg.raw.role === 'user')}
											<div class="mb-2 flex justify-center">
												<button
													type="button"
													onclick={() => fetchContextBefore(messageId, group.interviewId)}
													class="text-xs text-gray-500 transition-colors hover:text-gray-700"
													disabled={isLoadingBefore}
												>
													{#if isLoadingBefore}
														<i class="fa-solid fa-spinner fa-spin mr-1"></i>
														Loading context...
													{:else if hasContextBefore}
														<i class="fa-solid fa-minus mr-1"></i>
														Hide context before
													{:else}
														<i class="fa-solid fa-plus mr-1"></i>
														Show context before
													{/if}
												</button>
											</div>
										{/if}

										<!-- Display Context Before Messages -->
										{#if hasContextBefore}
											{@const contextMessages = messageContext.before.get(messageId) || []}
											{#each contextMessages as ctxMsg}
												{@const ctxUIMsg = transformToUIMessage(ctxMsg)}
												<div class="mb-2 opacity-60">
													<InterviewMessage
														message={ctxUIMsg}
														lang={lang || 'en'}
														isLast={false}
														readonly={true}
														onFeedback={() => {}}
														onSkip={() => {}}
														onSurveyAnswer={() => {}}
													/>
												</div>
											{/each}
										{/if}

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

										<!-- Display Context After Messages -->
										{#if hasContextAfter}
											{@const contextMessages = messageContext.after.get(messageId) || []}
											{#each contextMessages as ctxMsg}
												{@const ctxUIMsg = transformToUIMessage(ctxMsg)}
												<div class="mt-2 opacity-60">
													<InterviewMessage
														message={ctxUIMsg}
														lang={lang || 'en'}
														isLast={false}
														readonly={true}
														onFeedback={() => {}}
														onSkip={() => {}}
														onSurveyAnswer={() => {}}
													/>
												</div>
											{/each}
										{/if}

										<!-- Context After Button -->
										{#if !hasImmediateSiblingAfter && !msg.raw.is_introduction}
											<div class="mt-2 flex justify-center">
												<button
													type="button"
													onclick={() => fetchContextAfter(messageId, group.interviewId)}
													class="text-xs text-gray-500 transition-colors hover:text-gray-700"
													disabled={isLoadingAfter}
												>
													{#if isLoadingAfter}
														<i class="fa-solid fa-spinner fa-spin mr-1"></i>
														Loading context...
													{:else if hasContextAfter}
														<i class="fa-solid fa-minus mr-1"></i>
														Hide context after
													{:else}
														<i class="fa-solid fa-plus mr-1"></i>
														Show context after
													{/if}
												</button>
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
		// Close dropdowns on outside click
		const target = e.target as Element;
		const clickedInside = target.closest('.relative');
		if (!clickedInside) {
			showQuestionDropdown = false;
		}
	}}
/>
