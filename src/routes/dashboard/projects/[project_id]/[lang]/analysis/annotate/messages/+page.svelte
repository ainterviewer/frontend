<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { plainMarkup } from '$lib/utils/sanitize';
	import { Analysis, Projects, type Image, type MessagePublic } from '$lib/api';
	import type { InterviewGuide } from '$lib/api/types.gen';
	import { displayName, isApplicable, outlineOf } from '$lib/coding/codingTree';
	import { codebookFor } from '$lib/coding/store.svelte';
	import CodedMessage from '$lib/components/analysis/CodedMessage.svelte';
	import MessageCommentModal from '$lib/components/analysis/MessageCommentModal.svelte';
	import type { Message } from '$lib/components/interview/types';
	import { CommentSurface } from '$lib/stores/commentSurface.svelte';
	import { MessageCodings } from '$lib/stores/messageCodings.svelte';
	import { MessageComments } from '$lib/stores/messageComments.svelte';
	import { getContrastColor } from '$lib/utils/colors';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// State
	let projectId = $derived(page.params.project_id ?? '');
	let lang = $derived(page.params.lang ?? '');

	// Query params
	let codeIdsParam = $derived(page.url.searchParams.getAll('code_id'));
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

	// The project's codebook, shared with the Coding page rather than fetched
	// again here. Codes are read-only on this page: this is where a codebook is
	// *applied*, and editing it mid-coding is the other page's job.
	const book = $derived(codebookFor(projectId));
	let codes = $derived(book.status === 'ready' ? book.tree.codes : []);
	/** The codes a passage can actually carry — a group organises, never applies. */
	let applicableCodes = $derived(
		outlineOf(codes)
			.map((row) => row.code)
			.filter(isApplicable)
	);

	let guide = $state<InterviewGuide | null>(null);
	let rawMessages = $state<MessagePublic[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Pagination State
	const limit = 20;
	let hasMore = $state(true);
	let loadingMore = $state(false);

	// UI State
	let activeCodingMessageId = $state<string | null>(null);
	let showQuestionDropdown = $state(false);
	const surface = new CommentSurface();

	// The signed-in user: codings and comments are author specific, so this
	// decides what may be edited here.
	let userId = $derived(page.data.user?.id ?? '');
	// Moderation (editing or deleting someone else's comment) is the project's
	// to grant: platform admin, project owner, or folder admin. The server says
	// which, so the buttons match what the API will actually accept.
	let canModerate = $derived(page.data.permissions?.can_moderate ?? false);

	$effect(() => {
		surface.syncWidth();
	});

	// Search State (local form state)
	let searchText = $state('');
	let exactMatch = $state(false);
	let caseSensitive = $state(false);
	let showSearchOptions = $state(false);
	let selectedCodeIds = $state<string[]>([]);
	let selectedQuestions = $state<[number, number][]>([]);

	// Per-message context state (consolidated)
	const messageContext = {
		before: new SvelteMap<string, MessagePublic[]>(),
		after: new SvelteMap<string, MessagePublic[]>(),
		loadingBefore: new SvelteSet<string>(),
		loadingAfter: new SvelteSet<string>()
	};

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
			if (typeof imgSource?.data === 'string') {
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
		selectedCodeIds = codeIdsParam;
		selectedQuestions = questionsParam;
	});

	// Derived State
	let selectedCodes = $derived(codes.filter((code) => selectedCodeIds.includes(code.id)));

	// Map raw messages to UI messages and group by interview
	let groupedMessages = $derived.by(() => {
		/* eslint-disable svelte/prefer-svelte-reactivity -- locals of this pure computation, never escape */
		if (rawMessages.length === 0) return [];

		const activeMessages = new Map<string, MessagePublic>();
		const queue: MessagePublic[] = [];
		const rawIds = new Set<string>();

		// Initialize with raw messages
		for (const msg of rawMessages) {
			activeMessages.set(msg.id, msg);
			queue.push(msg);
			rawIds.add(msg.id);
		}

		// BFS to find all connected context messages
		let head = 0;
		while (head < queue.length) {
			const msg = queue[head++];

			// Check before context
			const before = messageContext.before.get(msg.id);
			if (before) {
				for (const ctxMsg of before) {
					if (!activeMessages.has(ctxMsg.id)) {
						activeMessages.set(ctxMsg.id, ctxMsg);
						queue.push(ctxMsg);
					}
				}
			}

			// Check after context
			const after = messageContext.after.get(msg.id);
			if (after) {
				for (const ctxMsg of after) {
					if (!activeMessages.has(ctxMsg.id)) {
						activeMessages.set(ctxMsg.id, ctxMsg);
						queue.push(ctxMsg);
					}
				}
			}
		}

		// Sort by interview_id then message_id
		const sorted = Array.from(activeMessages.values()).sort((a, b) => {
			if (a.interview_id !== b.interview_id) {
				return a.interview_id.localeCompare(b.interview_id);
			}
			return a.message_id - b.message_id;
		});

		// Create a map for quick lookup by ID to check for siblings
		const messageMap = new Map<string, MessagePublic>();
		// Also map by (interview_id, message_number) for gap checks
		const messageByNum = new Map<string, MessagePublic>();

		for (const msg of sorted) {
			messageMap.set(msg.id, msg);
			messageByNum.set(`${msg.interview_id}:${msg.message_id}`, msg);
		}

		// Calculate insertions for "Hide Context" buttons
		type Item =
			| {
					type: 'message';
					data: Message & {
						id: string;
						raw: MessagePublic;
						isContext: boolean;
						hasGapBefore: boolean;
						hasGapAfter: boolean;
					};
			  }
			| {
					type: 'context-control';
					action: 'hide-before' | 'hide-after';
					targetId: string;
					interviewId: string;
			  };

		const items: Item[] = [];
		const messageToIndex = new Map(sorted.map((m, i) => [m.id, i]));
		const insertions = new Map<number, { before: Item[]; after: Item[] }>();
		/* eslint-enable svelte/prefer-svelte-reactivity */

		const addInsertion = (index: number, position: 'before' | 'after', item: Item) => {
			if (!insertions.has(index)) insertions.set(index, { before: [], after: [] });
			insertions.get(index)![position].push(item);
		};

		// Iterate RAW messages to place context controls
		for (const rawMsg of rawMessages) {
			// Check Before
			const contextBefore = messageContext.before.get(rawMsg.id);
			if (contextBefore && contextBefore.length > 0) {
				let minIdx = Infinity;
				let found = false;
				for (const ctx of contextBefore) {
					const idx = messageToIndex.get(ctx.id);
					if (idx !== undefined) {
						if (idx < minIdx) minIdx = idx;
						found = true;
					}
				}

				if (found && minIdx !== Infinity) {
					addInsertion(minIdx, 'before', {
						type: 'context-control',
						action: 'hide-before',
						targetId: rawMsg.id,
						interviewId: rawMsg.interview_id
					});
				}
			}

			// Check After
			const contextAfter = messageContext.after.get(rawMsg.id);
			if (contextAfter && contextAfter.length > 0) {
				let maxIdx = -1;
				let found = false;
				for (const ctx of contextAfter) {
					const idx = messageToIndex.get(ctx.id);
					if (idx !== undefined) {
						if (idx > maxIdx) maxIdx = idx;
						found = true;
					}
				}

				if (found && maxIdx !== -1) {
					addInsertion(maxIdx, 'after', {
						type: 'context-control',
						action: 'hide-after',
						targetId: rawMsg.id,
						interviewId: rawMsg.interview_id
					});
				}
			}
		}

		// Build final flat list
		for (let i = 0; i < sorted.length; i++) {
			const msg = sorted[i];
			const ins = insertions.get(i);

			if (ins?.before) items.push(...ins.before);

			const uiMsg = transformToUIMessage(msg);
			const isContext = !rawIds.has(msg.id);

			// Check gaps
			const prevNum = msg.message_id - 1;
			const nextNum = msg.message_id + 1;
			const hasGapBefore = !messageByNum.has(`${msg.interview_id}:${prevNum}`);
			const hasGapAfter = !messageByNum.has(`${msg.interview_id}:${nextNum}`);

			// Check if we are inserting hide controls around this message
			const hasHideBeforeControl = ins?.before?.some(
				(item) => item.type === 'context-control' && item.action === 'hide-before'
			);
			const hasHideAfterControl = ins?.after?.some(
				(item) => item.type === 'context-control' && item.action === 'hide-after'
			);

			items.push({
				type: 'message',
				data: {
					...uiMsg,
					isContext,
					hasGapBefore: hasGapBefore && !hasHideBeforeControl,
					hasGapAfter: hasGapAfter && !hasHideAfterControl
				}
			});

			if (ins?.after) items.push(...ins.after);
		}

		const groups: {
			interviewId: string;
			items: Item[];
		}[] = [];
		let currentGroup: (typeof groups)[number] | null = null;

		for (const item of items) {
			const interviewId = item.type === 'message' ? item.data.raw.interview_id : item.interviewId;

			if (!currentGroup || currentGroup.interviewId !== interviewId) {
				currentGroup = { interviewId, items: [] };
				groups.push(currentGroup);
			}
			currentGroup.items.push(item);
		}

		return groups;
	});

	// Codings are per coder: only this reader's are editable here, and everyone
	// else's are shown named and read-only, so disagreement between coders stays
	// visible rather than being resolved by whoever coded last.
	const codings = new MessageCodings(() => projectId);
	const comments = new MessageComments(() => projectId);

	$effect(() => {
		codings.seed(rawMessages);
		comments.seed(rawMessages);
	});

	async function loadData() {
		if (!projectId) return;
		loading = true;
		error = null;

		const [guideRes, msgsRes] = await Promise.all([
			Projects.getGuide({ path: { project_id: projectId, lang: lang } }),
			Analysis.getFilteredMessages({
				path: { project_id: projectId },
				body: {
					code_ids: codeIdsParam.length > 0 ? codeIdsParam : null,
					search_text: searchTextParam || null,
					exact_match: exactMatchParam || undefined,
					case_sensitive: caseSensitiveParam || undefined,
					questions: questionsParam.length > 0 ? questionsParam : null
				},
				query: {
					limit,
					skip: 0
				}
			})
		]);

		if (msgsRes.error) {
			console.error('Failed to load messages', msgsRes.error);
			error = 'Failed to load data';
			loading = false;
			return;
		}

		// Guide is non-critical — don't fail if it errors
		if (guideRes.error) {
			console.warn('Failed to load guide:', guideRes.error);
		} else if (guideRes.data) {
			guide = guideRes.data;
		}
		if (msgsRes.data) {
			codings.clear();
			comments.clear();
			rawMessages = msgsRes.data;
			hasMore = msgsRes.data.length === limit;
		}

		loading = false;
	}

	$effect(() => {
		if (projectId) loadData();
	});

	async function loadMore() {
		if (loading || loadingMore || !hasMore || !projectId) return;

		loadingMore = true;

		const skip = rawMessages.length;
		const { data, error: err } = await Analysis.getFilteredMessages({
			path: { project_id: projectId },
			body: {
				code_ids: codeIdsParam.length > 0 ? codeIdsParam : null,
				search_text: searchTextParam || null,
				exact_match: exactMatchParam || undefined,
				case_sensitive: caseSensitiveParam || undefined,
				questions: questionsParam.length > 0 ? questionsParam : null
			},
			query: {
				limit,
				skip
			}
		});

		if (err) {
			console.error('Failed to load more messages', err);
			loadingMore = false;
			return;
		}
		if (data) {
			rawMessages = [...rawMessages, ...data];
			hasMore = data.length === limit;
		}

		loadingMore = false;
	}

	// Handle search form submission
	function handleSearch(e: Event) {
		e.preventDefault();
		updateSearchParams();
	}

	function updateSearchParams() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL builder for goto()
		const params = new URLSearchParams();
		selectedCodeIds.forEach((id) => params.append('code_id', id));
		selectedQuestions.forEach(([section, question]) =>
			params.append('question', `${section},${question}`)
		);
		if (searchText.trim()) {
			params.set('search_text', searchText.trim());
			if (exactMatch) params.set('exact_match', 'true');
			if (caseSensitive) params.set('case_sensitive', 'true');
		}
		goto(
			resolve(
				`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages?${params.toString()}`
			),
			{
				replaceState: false,
				keepFocus: true
			}
		);
	}

	function clearSearch() {
		searchText = '';
		exactMatch = false;
		caseSensitive = false;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL builder for goto()
		const params = new URLSearchParams();
		selectedCodeIds.forEach((id) => params.append('code_id', id));
		selectedQuestions.forEach(([section, question]) =>
			params.append('question', `${section},${question}`)
		);
		goto(
			resolve(
				`/dashboard/projects/${projectId}/${lang}/analysis/annotate/messages?${params.toString()}`
			),
			{
				replaceState: false
			}
		);
	}

	function toggleCodeFilter(codeId: string) {
		if (selectedCodeIds.includes(codeId)) {
			selectedCodeIds = selectedCodeIds.filter((id) => id !== codeId);
		} else {
			selectedCodeIds = [...selectedCodeIds, codeId];
		}
		updateSearchParams();
	}

	function clearCodeFilters() {
		selectedCodeIds = [];
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
		// As text: the only reader of this is a `title` attribute, where the
		// guide's inline markup would be shown as tags.
		return plainMarkup(questionData?.main_question ?? '');
	}

	// One picker row's worth of a question. Truncated as text rather than as
	// markup: the guide is authored with inline tags, and cutting the wording
	// mid-tag would leave a half-open element behind.
	function questionPreview(text: string): string {
		const plain = plainMarkup(text);
		return plain.length > 60 ? plain.substring(0, 60) + '...' : plain;
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

	/**
	 * Applying a code is one write, and a complete one.
	 *
	 * The annotation envelope this replaces held a coder's whole reading of a
	 * message in one row, so every click had to resend the set and there was a
	 * moment where half of it was stored. A coding is a single claim about a
	 * single passage, so a click either lands or does not.
	 */
	async function applyCode(
		messageId: string,
		codeId: string,
		span: { start: number; end: number } | null,
		value: number | null
	) {
		await codings.add(messageId, {
			code_id: codeId,
			start_offset: span?.start ?? null,
			end_offset: span?.end ?? null,
			value_int: value
		});
	}

	async function changeScore(messageId: string, codingId: string, value: number) {
		const existing = codings.get(messageId).find((coding) => coding.id === codingId);
		if (!existing) return;
		await codings.update(messageId, codingId, {
			code_id: existing.code_id,
			start_offset: existing.start_offset ?? null,
			end_offset: existing.end_offset ?? null,
			value_int: value
		});
	}

	async function fetchContextBefore(messageId: string, interviewId: string) {
		if (messageContext.before.has(messageId)) {
			messageContext.before.delete(messageId);
			return;
		}

		messageContext.loadingBefore.add(messageId);

		const { data, error: fetchErr } = await Analysis.getMessageContextBefore({
			path: { project_id: projectId, interview_id: interviewId, message_id: messageId }
		});

		if (fetchErr) {
			console.error('Error fetching context before:', fetchErr);
		} else if (data) {
			messageContext.before.set(messageId, data);
		}

		messageContext.loadingBefore.delete(messageId);
	}

	async function fetchContextAfter(messageId: string, interviewId: string) {
		if (messageContext.after.has(messageId)) {
			messageContext.after.delete(messageId);
			return;
		}

		messageContext.loadingAfter.add(messageId);

		const { data, error: fetchErr } = await Analysis.getMessageContextAfter({
			path: { project_id: projectId, interview_id: interviewId, message_id: messageId }
		});

		if (fetchErr) {
			console.error('Error fetching context after:', fetchErr);
		} else if (data) {
			messageContext.after.set(messageId, data);
		}

		messageContext.loadingAfter.delete(messageId);
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
					aria-label="Back to the codebook"
				>
					<i class="fa-solid fa-arrow-left text-lg"></i>
				</a>
				<div class="flex flex-col">
					<h1 class="text-xl font-semibold text-gray-800">
						{#if selectedCodes.length > 0 || selectedQuestions.length > 0}
							Filtered Messages
							{#if selectedCodes.length > 0}
								({selectedCodes.length}
								{selectedCodes.length === 1 ? 'code' : 'codes'}
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
										{#each guide.question_sections as section, sectionIdx (sectionIdx)}
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
															{#each section.questions as question, questionIdx (questionIdx)}
																{@const isSelected = selectedQuestions.some(
																	([s, q]) => s === sectionIdx && q === questionIdx
																)}
																<button
																	type="button"
																	onclick={(e) => {
																		stopEvent(e);
																		if (isSelected) removeQuestionFilter(sectionIdx, questionIdx);
																		else addQuestionFilter(sectionIdx, questionIdx);
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
																		{questionPreview(question.main_question)}
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

				<!-- The codebook, as a filter. One flat row rather than the old
				     split between tags and scores: a codebook is a tree, and the
				     kinds in it are not two lists a reader chooses between. Groups
				     are left out -- nothing is ever coded with one, so filtering
				     on one would always return nothing. -->
				{#if applicableCodes.length > 0}
					<div class="flex items-start gap-2">
						<span class="w-24 shrink-0 pt-1 text-xs text-gray-500">Codes:</span>
						<div class="flex flex-wrap items-center gap-2">
							{#each applicableCodes as code (code.id)}
								{@const isSelected = selectedCodeIds.includes(code.id)}
								<button
									type="button"
									onclick={(e) => {
										stopEvent(e);
										toggleCodeFilter(code.id);
									}}
									class="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all {isSelected
										? 'ring-2 ring-offset-1'
										: 'opacity-60 hover:opacity-100'}"
									style="background-color: {code.color}; color: {getContrastColor(code.color)};"
									title={code.definition || undefined}
								>
									{#if isSelected}
										<i class="fa-solid fa-check text-[10px]"></i>
									{/if}
									{displayName(code.name)}
								</button>
							{/each}
							{#if selectedCodeIds.length > 0}
								<button
									type="button"
									onclick={(e) => {
										stopEvent(e);
										clearCodeFilters();
									}}
									class="cursor-pointer text-xs text-gray-500 hover:text-gray-700 hover:underline"
								>
									Clear
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Active Filters -->
				{#if selectedQuestions.length > 0 || searchTextParam}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-gray-500">Active filters:</span>
						{#if selectedQuestions.length > 0}
							{#each selectedQuestions as [section, question] (`${section}-${question}`)}
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
	<div
		class="flex-1 overflow-y-auto bg-gray-50 p-4 xl:pr-[320px]"
		style="overflow-x: clip;"
		onscroll={(e) => {
			const target = e.target as HTMLElement;
			if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
				loadMore();
			}
		}}
	>
		<div class="mx-auto min-h-full max-w-4xl">
			<div class="space-y-6">
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
							{#if searchTextParam || selectedCodes.length > 0}
								No messages found matching your filters.
							{:else}
								No messages found.
							{/if}
						</p>
					</div>
				{:else}
					{#each groupedMessages as group (group.interviewId)}
						<div class="rounded-lg bg-white shadow-sm xl:overflow-visible">
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
								{#each group.items as item, _itemIndex (item.type === 'message' ? item.data.id : `ctrl-${item.action}-${item.targetId}`)}
									{#if item.type === 'message'}
										{@const msg = item.data}
										{@const messageId = msg.id}

										{#if msg.type === 'system'}
											<div class="my-2 text-center text-sm text-gray-500">{msg.text}</div>
										{:else}
											{@const isMainQuestion =
												msg.raw.sub_question === null || msg.raw.sub_question === 0}
											{@const hasContextBefore = messageContext.before.has(messageId)}
											{@const hasContextAfter = messageContext.after.has(messageId)}
											{@const isLoadingBefore = messageContext.loadingBefore.has(messageId)}
											{@const isLoadingAfter = messageContext.loadingAfter.has(messageId)}

											<CodedMessage
												message={msg}
												{messageId}
												content={msg.raw.content}
												lang={lang || 'en'}
												{codes}
												codings={codings.get(messageId)}
												{comments}
												{surface}
												currentUserId={userId}
												{canModerate}
												dimmed={msg.isContext}
												codingOpen={activeCodingMessageId === messageId}
												savingCoding={codings.isPending(messageId)}
												onToggleCoding={() =>
													(activeCodingMessageId =
														activeCodingMessageId === messageId ? null : messageId)}
												onApply={(codeId, span, value) => applyCode(messageId, codeId, span, value)}
												onChangeValue={(codingId, value) => changeScore(messageId, codingId, value)}
												onRemoveCoding={(codingId) => codings.remove(messageId, codingId)}
												onCancelCoding={() => (activeCodingMessageId = null)}
											>
												{#snippet beforeMessage()}
													<!-- Context before (only if not loaded and there is a gap) -->
													{#if !hasContextBefore && msg.hasGapBefore && (!isMainQuestion || msg.raw.role === 'user')}
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
																{:else}
																	<i class="fa-solid fa-plus mr-1"></i>
																	Show context before
																{/if}
															</button>
														</div>
													{/if}
												{/snippet}

												{#snippet afterMessage()}
													<!-- Context after (only if not loaded and there is a gap) -->
													{#if !hasContextAfter && msg.hasGapAfter && !msg.raw.is_introduction}
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
																{:else}
																	<i class="fa-solid fa-plus mr-1"></i>
																	Show context after
																{/if}
															</button>
														</div>
													{/if}
												{/snippet}
											</CodedMessage>
										{/if}
									{:else if item.type === 'context-control'}
										<div class="my-2 flex justify-center">
											<button
												type="button"
												onclick={() => {
													if (item.action === 'hide-before') {
														fetchContextBefore(item.targetId, item.interviewId);
													} else {
														fetchContextAfter(item.targetId, item.interviewId);
													}
												}}
												class="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
											>
												<i class="fa-solid fa-minus text-[10px]"></i>
												{item.action === 'hide-before'
													? 'Hide context before'
													: 'Hide context after'}
											</button>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/each}

					{#if loadingMore}
						<div class="flex justify-center py-4">
							<i class="fas fa-spinner fa-spin text-xl text-gray-400"></i>
						</div>
					{/if}
				{/if}
			</div>
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
	onclick={(e) => {
		const target = e.target as Element;

		// Close dropdowns on outside click
		const clickedInside = target.closest('.relative');
		if (!clickedInside) {
			showQuestionDropdown = false;
		}
	}}
/>
