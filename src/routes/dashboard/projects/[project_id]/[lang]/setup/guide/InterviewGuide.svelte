<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import type { InterviewGuideOutput } from '$lib/api/types.gen';
	import {
		DragDropProvider,
		DragOverlay,
		KeyboardSensor,
		PointerSensor
	} from '@dnd-kit-svelte/svelte';
	import { move } from '@dnd-kit/helpers';
	import GenerateModal from './GenerateModal.svelte';
	import InterviewGuideSidebar from './InterviewGuideSidebar.svelte';
	import SortableQuestion from './SortableQuestion.svelte';
	import SortableSection from './SortableSection.svelte';
	import type { GuideQuestion, GuideSection } from './types';
	import { generateId, mapFromLocal, mapToLocal, saveGuide } from './utils';
	import { Projects } from '$lib/api';

	const sensors = [KeyboardSensor, PointerSensor];

	let { guide: initialGuide } = $props<{ guide: InterviewGuideOutput | null }>();

	// State
	let saving = $state(false);
	// svelte-ignore state_referenced_locally
	let guide = $state<InterviewGuideOutput>(
		initialGuide ?? {
			framing: '',
			introduction: '',
			question_sections: [],
			outro: ''
		}
	);

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

	let projectId = $state(page.params.project_id ?? '');

	let lang = $state(page.params.lang ?? '');
	let activeItem = $state<GuideSection | GuideQuestion | null>(null);

	// Modal state
	let showGenerateGuideModal = $state(false);
	let showGenerateSectionModal = $state(false);
	let showGenerateQuestionModal = $state(false);
	let generatingQuestionSectionId = $state<string | null>(null);

	let activeId = $state('');

	async function handleGenerateGuide(prompt: string) {
		await Projects.generateGuide({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		await invalidateAll();
	}

	async function handleGenerateSection(prompt: string) {
		await Projects.generateGuideSection({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		await invalidateAll();
	}

	async function handleGenerateQuestion(prompt: string) {
		// Note: The API currently doesn't accept a section ID for question generation.
		// We send the prompt and rely on the backend or subsequent logic.
		// If we could, we would pass generatingQuestionSectionId.
		await Projects.generateSectionQuestion({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		await invalidateAll();
		generatingQuestionSectionId = null;
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
		const { current } = event.operation.source;
		if (current.type === 'section') {
			activeItem = current.data.section;
		} else if (current.type === 'question') {
			activeItem = current.data.question;
		}
	}

	function handleDragEnd() {
		activeItem = null;
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
		['framing', 'introduction', 'sections', 'outro'].forEach((id) => {
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

<div class="mb-6 flex items-center justify-between">
	<h1 class="page-title">Interview Guide</h1>
</div>

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
				Present the framing of your interview. Is only used by the model to pose more relevant
				questions.
			</p>
			<textarea
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
				in the chat.
			</p>
			<textarea
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
							onRemove={() => removeSection(sIdx)}
							onGenerateQuestion={() => {
								generatingQuestionSectionId = section.id;
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
						class="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-secondary bg-secondary/50 py-4 font-medium text-gray-600 hover:bg-secondary"
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
				class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				bind:value={guide.outro}
			></textarea>
		</div>

		<!-- Actions -->
		<div
			class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
		>
			<a
				class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
				href={resolve(`/interview?id=${projectId}&test=true`)}
				target="_blank"
			>
				<i class="fa-solid fa-person-circle-question"></i>
				Try Interview
			</a>
			<button
				class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
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
