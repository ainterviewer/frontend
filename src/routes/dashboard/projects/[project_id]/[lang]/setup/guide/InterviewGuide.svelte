<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type {
		InterviewGuideOutput,
		QuestionOutput,
		QuestionSectionQuestionOutput
	} from '$lib/api/types.gen';
	import { toast } from 'svelte-sonner';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import {
		DragDropProvider,
		DragOverlay,
		KeyboardSensor,
		PointerSensor
	} from '@dnd-kit-svelte/svelte';
	import { dragState } from './dragState.svelte';
	import { move } from '@dnd-kit/helpers';
	import GenerateModal from './GenerateModal.svelte';
	import InterviewGuideSidebar from './InterviewGuideSidebar.svelte';
	import SortableQuestion from './SortableQuestion.svelte';
	import SortableSection from './SortableSection.svelte';
	import type { GuideQuestion, GuideSection } from './types';
	import { generateId, mapFromLocal, mapToLocal, saveGuide } from './utils';

	const sensors = [KeyboardSensor, PointerSensor];

	let { guide: initialGuide, lang } = $props<{
		guide: InterviewGuideOutput | null;
		lang: string;
	}>();

	// State
	let saving = $state(false);
	// svelte-ignore state_referenced_locally
	let guide = $state<InterviewGuideOutput>(
		initialGuide ?? {
			framing: '',
			introduction: '',
			question_sections: [],
			outro: '',
			timed_messages: []
		}
	);

	// Ensure timed_messages is initialized
	if (!guide.timed_messages) {
		guide.timed_messages = [];
	}

	let mapped = mapToLocal(guide);
	if (mapped.sections.length === 0) {
		const newId = generateId();
		mapped.sections.push({
			id: newId,
			description: '',
			questions: [],
			shuffle: false
		});
		mapped.questions[newId] = [];
	}

	// Split state for DnD (Required for dnd-kit-svelte move helper)
	let localSections = $state<GuideSection[]>(mapped.sections);
	let localQuestions = $state<Record<string, GuideQuestion[]>>(mapped.questions);

	function getSnapshot() {
		return JSON.stringify({
			guide,
			sections: localSections,
			questions: localQuestions
		});
	}

	let savedSnapshot = $state(getSnapshot());

	beforeNavigate(({ cancel }) => {
		if (getSnapshot() !== savedSnapshot) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
				cancel();
			}
		}
	});

	let projectId = $state(page.params.project_id ?? '');

	let activeItem = $state<GuideSection | GuideQuestion | null>(null);
	let activeDragType = $state<'section' | 'question' | null>(null);
	$effect(() => {
		dragState.draggingType = activeDragType;
	});

	// Modal state
	let showGenerateGuideModal = $state(false);
	let showGenerateSectionModal = $state(false);
	let showGenerateQuestionModal = $state(false);
	let generatingQuestionSectionId = $state<string | null>(null);
	let generatingQuestionSectionIdx = $state<number | null>(null);

	let activeId = $state('');

	async function handleGenerateGuide(prompt: string) {
		await Projects.generateGuide({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		await invalidateAll();
	}

	async function handleGenerateSection(prompt: string) {
		const { data, error } = await Projects.generateGuideSection({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});

		if (error) {
			console.error('Failed to generate section', error);
			toast.error('Failed to generate section');
			return;
		}

		if (data) {
			const section = data as QuestionSectionQuestionOutput;
			const newId = generateId();
			const newSection: GuideSection = {
				id: newId,
				description: section.description,
				questions: [],
				shuffle: section.shuffle ?? false
			};

			localSections.push(newSection);
			localQuestions[newId] = (section.questions || []).map((q) => ({
				...q,
				id: generateId(),
				alternative_main_questions: q.alternative_main_questions || [],
				image: q.image || null,
				survey_item: q.survey_item || null,
				conditions: q.conditions || null,
				can_skip: q.can_skip ?? true,
				check_if_answered: q.check_if_answered ?? false,
				check_if_exhausted: q.check_if_exhausted ?? false,
				create_segue: q.create_segue ?? false,
				exclude_from_history: q.exclude_from_history ?? false,
				user_image: q.user_image ?? false,
				shuffle: q.shuffle ?? false,
				probes: q.probes || [],
				max_probes_n: q.max_probes_n ?? 3,
				max_probes_time: q.max_probes_time ?? null,
				can_answer: q.can_answer ?? true
			}));
		}
	}

	async function handleGenerateQuestion(prompt: string) {
		if (generatingQuestionSectionIdx === null || !generatingQuestionSectionId) return;

		const { data, error } = await Projects.generateSectionQuestion({
			path: { project_id: projectId, lang: lang },
			body: {
				prompt,
				section_idx: generatingQuestionSectionIdx
			}
		});

		if (error) {
			console.error('Failed to generate question', error);
			toast.error('Failed to generate question');
			return;
		}

		if (data) {
			const q = data as QuestionOutput;
			const newQuestion: GuideQuestion = {
				...q,
				id: generateId(),
				alternative_main_questions: q.alternative_main_questions || [],
				image: q.image || null,
				survey_item: q.survey_item || null,
				conditions: q.conditions || null,
				can_skip: q.can_skip ?? true,
				check_if_answered: q.check_if_answered ?? false,
				check_if_exhausted: q.check_if_exhausted ?? false,
				create_segue: q.create_segue ?? false,
				exclude_from_history: q.exclude_from_history ?? false,
				user_image: q.user_image ?? false,
				shuffle: q.shuffle ?? false,
				probes: q.probes || [],
				max_probes_n: q.max_probes_n ?? 3,
				max_probes_time: q.max_probes_time ?? null,
				can_answer: q.can_answer ?? true
			};

			if (!localQuestions[generatingQuestionSectionId]) {
				localQuestions[generatingQuestionSectionId] = [];
			}
			localQuestions[generatingQuestionSectionId].push(newQuestion);
		}

		generatingQuestionSectionId = null;
		generatingQuestionSectionIdx = null;
	}

	function addTimedMessage() {
		guide.timed_messages!.push({
			message: '',
			time: 0,
			include_in_history: false,
			as_modal: false
		});
	}

	function removeTimedMessage(index: number) {
		guide.timed_messages!.splice(index, 1);
	}

	function addSection() {
		const newId = generateId();
		localSections.push({
			id: newId,
			description: '',
			questions: [],
			shuffle: false
		});
		localQuestions[newId] = [];
	}

	function removeSection(index: number) {
		if (confirm('Are you sure you want to delete this section?')) {
			const [removed] = localSections.splice(index, 1);
			delete localQuestions[removed.id];
		}
	}

	function exportJson() {
		const data = {
			...guide,
			question_sections: mapFromLocal(localSections, localQuestions)
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'interview_guide.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function arrayMove<T>(array: T[], from: number, to: number): T[] {
		const newArray = array.slice();
		newArray.splice(to, 0, newArray.splice(from, 1)[0]);
		return newArray;
	}

	function handleDragOver(event: any) {
		const { source, target } = event.operation;
		if (!target) return;

		// Section reordering
		if (source.type === 'section') {
			if (target.type === 'section' && source.id !== target.id) {
				const oldIndex = localSections.findIndex((s) => s.id === source.id);
				const newIndex = localSections.findIndex((s) => s.id === target.id);
				if (oldIndex !== -1 && newIndex !== -1) {
					localSections = arrayMove(localSections, oldIndex, newIndex);
				}
			}
			return;
		}

		// Question reordering (using move helper for nested/record structure)
		localQuestions = move(localQuestions as any, event);
	}

	function handleDragStart(event: any) {
		const source = event.operation?.source;
		const data = source?.data ?? source?.current?.data;
		const type = source?.type ?? source?.current?.type;
		activeDragType = type ?? null;
		if (type === 'section') {
			activeItem = data?.section;
		} else if (type === 'question') {
			activeItem = data?.question;
		}
	}

	function handleDragEnd() {
		activeItem = null;
		activeDragType = null;
	}

	let observer: IntersectionObserver;

	$effect(() => {
		// Track dependencies so effect re-runs on changes
		localSections;
		localQuestions;

		if (observer) observer.disconnect();

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
					}
				});
			},
			{
				rootMargin: '-10% 0px -80% 0px' // Trigger when element is near top
			}
		);

		// Observe static elements
		['framing', 'introduction', 'sections', 'outro', 'timed_messages'].forEach((id) => {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		});

		// Observe sections and questions
		localSections.forEach((s) => {
			const el = document.getElementById(s.id);
			if (el) observer.observe(el);
			const questions = localQuestions[s.id] || [];
			questions.forEach((q) => {
				const qEl = document.getElementById(q.id);
				if (qEl) observer.observe(qEl);
			});
		});

		return () => observer.disconnect();
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (getSnapshot() !== savedSnapshot) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

<h1 class="page-title">Interview Guide</h1>

<p class="mb-6 text-gray-600">
	On this page, you can create an interview guide that will be used by AInterviewer to conduct the
	model. The interview guide consists of different components with different settings.
</p>

<div class="relative flex items-start gap-8">
	<!-- Navigation Sidebar -->
	<InterviewGuideSidebar {activeId} {localSections} {localQuestions} />

	<div class="min-w-0 flex-1 space-y-8">
		<!-- Framing -->
		<div id="framing" class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-2 text-lg font-medium">Framing</h3>
			<p class="mb-4 text-sm text-gray-500">
				Present the framing of your interview and relevant background information. This is only used
				by the model to help it ask more relevant questions.
			</p>
			<textarea
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
				bind:value={guide.framing}
			></textarea>
		</div>

		<!-- Introduction -->
		<div
			id="introduction"
			class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
		>
			<h3 class="mb-2 text-lg font-medium">Introduction</h3>
			<p class="mb-4 text-sm text-gray-500">
				Write an introduction to your interview. This is the first message the interviewee will see
				in the chat and cannot be answered.
			</p>
			<textarea
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
				bind:value={guide.introduction}
			></textarea>
		</div>

		<!-- Sections -->
		<div id="sections" class="scroll-mt-6">
			<h3 class="mb-2 text-lg font-medium">Question sections</h3>
			<p class="mb-4 text-sm text-gray-500">
				Group your questions into multiple relevant sections.
			</p>

			<DragDropProvider
				{sensors}
				onDragOver={handleDragOver}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<div class="space-y-6">
					{#each localSections as section, sIdx (section.id)}
						<SortableSection
							{section}
							questions={localQuestions[section.id]}
							sectionIndex={sIdx}
							allSections={localSections}
							allQuestions={localQuestions}
							onRemove={() => removeSection(sIdx)}
							onGenerateQuestion={() => {
								generatingQuestionSectionId = section.id;
								generatingQuestionSectionIdx = sIdx;
								showGenerateQuestionModal = true;
							}}
					/>
					{/each}
				</div>

				<div class="mt-6 grid grid-cols-2 gap-4">
					<button
						class="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 py-4 font-medium text-gray-600 hover:bg-gray-100"
						onclick={addSection}
					>
						<i class="fa-solid fa-plus"></i> Add Section
					</button>
					<button
						class="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 py-4 font-medium text-gray-600 hover:bg-gray-100"
						onclick={() => (showGenerateSectionModal = true)}
					>
						<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Section
					</button>
				</div>

				<DragOverlay>
					{#snippet children(active)}
						{#if activeItem}
							{#if active.data.current?.type === 'section'}
								<SortableSection
									section={activeItem as GuideSection}
									questions={localQuestions[(activeItem as GuideSection).id] || []}
									sectionIndex={localSections.findIndex((s) => s.id === activeItem?.id) ?? 0}
									onRemove={() => {}}
									isOverlay
								/>
							{:else if active.data.current?.type === 'question'}
								<SortableQuestion
									question={activeItem as GuideQuestion}
									sectionId={active.data.current?.sectionId}
									index={0}
									sectionIndex={0}
									onRemove={() => {}}
									isOverlay
								/>
							{/if}
						{/if}
					{/snippet}
				</DragOverlay>
			</DragDropProvider>
		</div>

		<!-- Outro -->
		<div id="outro" class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-2 text-lg font-medium">Outro</h3>
			<p class="mb-4 text-sm text-gray-500">Last message in the interview.</p>
			<textarea
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
				bind:value={guide.outro}
			></textarea>
		</div>

		<!-- Timed Messages -->
		<div
			id="timed_messages"
			class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
		>
			<h3 class="mb-2 text-lg font-medium">Timed Messages</h3>
			<p class="mb-4 text-sm text-gray-500">
				Schedule messages to be sent to the interviewee during the interview after a specified
				number of seconds.
			</p>

			<div class="space-y-4">
				{#each guide.timed_messages! as tm, i}
					<div class="rounded-md border border-gray-200 bg-gray-50 p-4">
						<div class="mb-3 flex items-center justify-between">
							<span class="text-sm font-medium text-gray-700">Timed Message {i + 1}</span>
							<button
								class="cursor-pointer text-sm text-gray-700 transition-colors hover:text-red-500"
								onclick={() => removeTimedMessage(i)}
								title="Remove timed message"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</div>

						<div class="space-y-3">
							<div>
								<label class="mb-1 block text-sm font-medium text-gray-600" for="tm-message-{i}">
									Message
								</label>
								<textarea
									id="tm-message-{i}"
									class="h-20 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
									bind:value={tm.message}
								></textarea>
							</div>

							<div>
								<label class="mb-1 block text-sm font-medium text-gray-600" for="tm-time-{i}">
									Time (seconds)
								</label>
								<input
									id="tm-time-{i}"
									type="number"
									min="0"
									class="w-32 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
									bind:value={tm.time}
								/>
							</div>

							<div class="flex gap-6">
								<div class="flex gap-2">
									<label
										class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
									>
										<input
											class="rounded border-gray-300 text-primary focus:ring-primary"
											type="checkbox"
											bind:checked={tm.include_in_history}
										/>
										Include in history
									</label>
									<HoverInfo
										text="Includes the question in the conversation history. This means that the AInterviewer will have access to the information from this message when asking other questions."
									></HoverInfo>
								</div>
								<div class="flex hidden gap-2">
									<label
										class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
									>
										<input
											class="rounded border-gray-300 text-primary focus:ring-primary"
											type="checkbox"
											bind:checked={tm.as_modal}
										/>
										Show as modal
									</label>
									<HoverInfo
										text="Should the message be shown as a modal (pop-up message) instead of a normal message in the chat interface?"
									></HoverInfo>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<button
				class="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-300 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
				onclick={addTimedMessage}
			>
				<i class="fa-solid fa-plus"></i> Add Timed Message
			</button>
		</div>

		<!-- Actions -->
		<div
			class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
		>
			<a
				class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
				href={resolve(`/interview?id=${projectId}&interview_type=manual_test&lang=${lang}`)}
				target="_blank"
				rel="opener"
			>
				<i class="fa-solid fa-person-circle-question"></i>
				Try Interview
			</a>
			<!-- FIXME: -->
			<button
				class="hidden rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
				onclick={exportJson}
			>
				<i class="fa-solid fa-file-export"></i>
				Export JSON
			</button>
			<button
				class="rounded-full bg-secondary px-6 py-2 font-medium text-gray-700 hover:brightness-95"
				onclick={() => (showGenerateGuideModal = true)}
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i>
				Generate
			</button>
			<button
				class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark"
				onclick={async () => {
					saving = true;
					await saveGuide(projectId, lang, guide, localSections, localQuestions);
					savedSnapshot = getSnapshot();
					saving = false;
				}}
				disabled={saving}
			>
				<i class="fa-solid fa-floppy-disk"></i>
				Save Changes
			</button>
		</div>
	</div>
</div>

<GenerateModal
	bind:open={showGenerateGuideModal}
	title="Generate Interview Guide"
	placeholder="Describe the interview you want to generate..."
	onGenerate={handleGenerateGuide}
/>

<GenerateModal
	bind:open={showGenerateSectionModal}
	title="Generate Question Section"
	placeholder="Describe the section you want to generate..."
	onGenerate={handleGenerateSection}
/>

<GenerateModal
	bind:open={showGenerateQuestionModal}
	title="Generate Question"
	placeholder="Describe the question you want to generate..."
	onGenerate={handleGenerateQuestion}
/>
