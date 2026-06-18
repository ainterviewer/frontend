<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type {
		Consent,
		ExternalParam,
		InterviewGuideOutput,
		LanguageDict,
		QuestionOutput,
		QuestionSectionQuestionOutput,
		Welcome
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';
	import { toast } from 'svelte-sonner';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import SetupActionBar from '../SetupActionBar.svelte';
	import { downloadUnifiedSetupJson } from '../exportJson';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import GenerateModal from './GenerateModal.svelte';
	import InterviewGuideSidebar from './InterviewGuideSidebar.svelte';
	import SortableSection from './SortableSection.svelte';
	import type { GuideQuestion, GuideSection } from './types';
	import {
		generateId,
		mapFromLocal,
		mapToLocal,
		normalizeGeneratedQuestions,
		saveGuide
	} from './utils';

	let {
		guide: initialGuide,
		lang,
		projectName = '',
		availableLanguages = [],
		externalParams = []
	} = $props<{
		guide: InterviewGuideOutput | null;
		lang: string;
		projectName?: string;
		availableLanguages?: LanguageDict[];
		externalParams?: ExternalParam[];
	}>();

	const guideStore = getGuideStore();

	// State
	let saving = $state(false);
	let exporting = $state(false);
	let guide = $state<InterviewGuideOutput>({
		framing: '',
		introduction: '',
		question_sections: [],
		outro: '',
		timed_messages: []
	});

	function applyGuide(next: InterviewGuideOutput | null) {
		guide = next ?? {
			framing: '',
			introduction: '',
			question_sections: [],
			outro: '',
			timed_messages: []
		};

		// Ensure timed_messages is initialized
		if (!guide.timed_messages) {
			guide.timed_messages = [];
		}

		if (guide.ai_generated_sections === undefined) {
			guide.ai_generated_sections = 0;
		}

		const mapped = mapToLocal(guide);
		if (mapped.sections.length === 0) {
			const newId = generateId();
			mapped.sections.push({
				id: newId,
				description: '',
				questions: [],
				shuffle: false,
				ai_generated_questions: { n: 0, max_probes_n: null, max_probes_time: null }
			});
			mapped.questions[newId] = [];
		}

		// Initialize the shared store
		guideStore.localSections = mapped.sections;
		guideStore.localQuestions = mapped.questions;
		guideStore.guide = guide;

		// Normalize question_sections synchronously so the initial snapshot
		// matches what the $effect will produce (mapToLocal → mapFromLocal
		// round-trip adds defaults / strips ids, changing the JSON).
		guide.question_sections = mapFromLocal(guideStore.localSections, guideStore.localQuestions);
	}

	// svelte-ignore state_referenced_locally
	applyGuide(initialGuide);

	$effect(() => {
		guide.question_sections = mapFromLocal(guideStore.localSections, guideStore.localQuestions);
	});

	function getSnapshot() {
		return JSON.stringify({
			guide,
			sections: guideStore.localSections,
			questions: guideStore.localQuestions
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
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);

	// Modal state
	let showGenerateGuideModal = $state(false);
	let showGenerateSectionModal = $state(false);
	let showGenerateQuestionModal = $state(false);
	let generatingQuestionSectionId = $state<string | null>(null);
	let generatingQuestionSectionIdx = $state<number | null>(null);

	let activeId = $state('');

	async function handleGenerateGuide(prompt: string) {
		const { error } = await Projects.generateGuide({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		if (error) {
			console.error('Failed to generate guide', error);
			toast.error('Failed to generate guide');
			return;
		}
		// Reload page data and replace the local editing state with the
		// freshly generated guide (it is already persisted server-side).
		await invalidateAll();
		applyGuide(page.data.guide ?? null);
		savedSnapshot = getSnapshot();
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
				shuffle: section.shuffle ?? false,
				ai_generated_questions: normalizeGeneratedQuestions(section.ai_generated_questions)
			};

			guideStore.localSections.push(newSection);
			guideStore.localQuestions[newId] = (section.questions || []).map((q) => ({
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

			if (!guideStore.localQuestions[generatingQuestionSectionId]) {
				guideStore.localQuestions[generatingQuestionSectionId] = [];
			}
			guideStore.localQuestions[generatingQuestionSectionId].push(newQuestion);
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
		guideStore.localSections.push({
			id: newId,
			description: '',
			questions: [],
			shuffle: false,
			ai_generated_questions: { n: 0, max_probes_n: null, max_probes_time: null }
		});
		guideStore.localQuestions[newId] = [];
	}

	function removeSection(index: number) {
		if (confirm('Are you sure you want to delete this section?')) {
			const [removed] = guideStore.localSections.splice(index, 1);
			delete guideStore.localQuestions[removed.id];
		}
	}

	let showExportPdfModal = $state(false);

	async function fetchConsent(): Promise<Consent | null> {
		const { data } = await Projects.getConsent({
			path: { project_id: projectId, language: lang }
		});
		return data ?? null;
	}

	async function fetchWelcome(): Promise<Welcome | null> {
		const { data } = await Projects.getWelcome({
			path: { project_id: projectId, language: lang }
		});
		return data ?? null;
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const [consent, welcome] = await Promise.all([
				toggles.consent ? fetchConsent() : Promise.resolve(null),
				toggles.welcome ? fetchWelcome() : Promise.resolve(null)
			]);
			await downloadGuidePdf({
				guide,
				sections: guideStore.localSections,
				questions: guideStore.localQuestions,
				projectName: projectName || 'Interview Guide',
				platformVersion,
				toggles,
				consent,
				welcome
			});
			showExportPdfModal = false;
		} catch (e) {
			console.error('Failed to export PDF', e);
			toast.error('Failed to export PDF');
		} finally {
			exporting = false;
		}
	}

	async function exportJson() {
		try {
			const [consentRes, welcomeRes] = await Promise.allSettled([fetchConsent(), fetchWelcome()]);
			downloadUnifiedSetupJson({
				consent: consentRes.status === 'fulfilled' ? consentRes.value : null,
				welcome: welcomeRes.status === 'fulfilled' ? welcomeRes.value : null,
				interview_guide: {
					...guide,
					question_sections: mapFromLocal(guideStore.localSections, guideStore.localQuestions)
				},
				platform_version: platformVersion
			});
		} catch (e) {
			console.error('Failed to export JSON', e);
			toast.error('Failed to export JSON');
		}
	}

	$effect(() => {
		// Track dependencies so effect re-runs on changes
		void guideStore.localSections;
		void guideStore.localQuestions;

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
		guideStore.localSections.forEach((s) => {
			const el = document.getElementById(s.id);
			if (el) observer.observe(el);
			const questions = guideStore.localQuestions[s.id] || [];
			questions.forEach((q) => {
				const qEl = document.getElementById(q.id);
				if (qEl) observer.observe(qEl);
			});
		});

		return () => observer.disconnect();
	});

	let observer: IntersectionObserver;
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (getSnapshot() !== savedSnapshot) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

<div>
	<div class="flex justify-between">
		<h1 class="page-title">Interview Guide</h1>
		<button
			data-tour="generate"
			class="mb-2 rounded-full bg-secondary px-6 font-medium text-gray-700 hover:brightness-95"
			onclick={() => (showGenerateGuideModal = true)}
		>
			<i class="fa-solid fa-wand-magic-sparkles"></i>
			Generate
		</button>
	</div>

	<p class="mb-6 text-gray-600">
		On this page, you can create an interview guide that will be used by AInterviewer to conduct the
		model. The interview guide consists of different components with different settings.
	</p>

	<div class="relative flex items-start gap-8">
		<!-- Navigation Sidebar -->
		<InterviewGuideSidebar
			{activeId}
			localSections={guideStore.localSections}
			localQuestions={guideStore.localQuestions}
		/>

		<div class="min-w-0 flex-1 space-y-8">
			<!-- Framing -->
			<div
				data-tour="framing"
				id="framing"
				class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<h3 class="mb-2 text-lg font-medium">Framing</h3>
				<p class="mb-4 text-sm text-gray-500">
					Present the framing of your interview and relevant background information. This is only
					used by the model to help it ask more relevant questions.
				</p>
				<textarea
					autocomplete="off"
					class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
					bind:value={guide.framing}
				></textarea>
			</div>

			<!-- Introduction -->
			<div
				data-tour="introduction"
				id="introduction"
				class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<h3 class="mb-2 text-lg font-medium">Introduction</h3>
				<p class="mb-4 text-sm text-gray-500">
					Write an introduction to your interview. This is the first message the interviewee will
					see in the chat and cannot be answered.
				</p>
				<textarea
					autocomplete="off"
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

				<div class="space-y-6">
					{#each guideStore.localSections as section, sIdx (section.id)}
						<SortableSection
							{section}
							dataTour={sIdx === 0 ? 'section' : undefined}
							questions={guideStore.localQuestions[section.id]}
							sectionIndex={sIdx}
							allSections={guideStore.localSections}
							allQuestions={guideStore.localQuestions}
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
			</div>

			<!-- AI Generated Sections -->
			<div class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div class="flex items-center gap-3">
					<label class="text-sm font-medium text-gray-700" for="ai-generated-sections">
						AI Generated Sections
					</label>
					<input
						id="ai-generated-sections"
						type="number"
						min="0"
						class="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
						bind:value={guide.ai_generated_sections}
					/>
					<HoverInfo
						text="Specifies the number of sections that will be automatically generated once the predefined ones are finished."
					/>
				</div>
			</div>

			<!-- Outro -->
			<div id="outro" class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="mb-2 text-lg font-medium">Outro</h3>
				<p class="mb-4 text-sm text-gray-500">Last message in the interview.</p>
				<textarea
					autocomplete="off"
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
					{#each guide.timed_messages! as tm, i (i)}
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
										autocomplete="off"
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

			<SetupActionBar
				{projectId}
				{lang}
				{availableLanguages}
				{saving}
				{exporting}
				onSave={async () => {
					saving = true;
					await saveGuide(
						projectId,
						lang,
						guide,
						guideStore.localSections,
						guideStore.localQuestions,
						externalParams
					);
					savedSnapshot = getSnapshot();
					saving = false;
				}}
				onExportPdf={() => {
					showExportPdfModal = true;
				}}
				onExportJson={exportJson}
			/>
		</div>
	</div>
</div>

<ExportPdfModal bind:open={showExportPdfModal} {exporting} onExport={handleExportPdf} />

<GenerateModal
	bind:open={showGenerateGuideModal}
	title="Generate Interview Guide"
	description="Generate a full interview guide from a short brief."
	placeholder="Describe the interview you want to generate..."
	onGenerate={handleGenerateGuide}
/>

<GenerateModal
	bind:open={showGenerateSectionModal}
	title="Generate Question Section"
	description="Generate a new question section based on your description."
	placeholder="Describe the section you want to generate..."
	onGenerate={handleGenerateSection}
/>

<GenerateModal
	bind:open={showGenerateQuestionModal}
	title="Generate Question"
	description="Generate a single question to add to this section."
	placeholder="Describe the question you want to generate..."
	onGenerate={handleGenerateQuestion}
/>
