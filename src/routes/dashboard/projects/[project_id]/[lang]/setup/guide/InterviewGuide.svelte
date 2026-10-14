<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type {
		Consent,
		ExternalParam,
		LocalizedInterviewGuide,
		ProjectLanguage,
		Welcome
	} from '$lib/api/types.gen';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { contentRevision } from '$lib/content/revision.svelte';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import { downloadUnifiedSetupJson } from '../exportJson';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import SetupActionBar from '../SetupActionBar.svelte';
	import TranslationBanner from '../TranslationBanner.svelte';
	import BulkSettingsModal from './BulkSettingsModal.svelte';
	import GenerateModal from './GenerateModal.svelte';
	import InterviewGuideSidebar from './InterviewGuideSidebar.svelte';
	import { countUntranslated, pick } from './localized';
	import { addLocalSections, localQuestion, mapToLocal, newSection } from './normalize';
	import { renderLocal } from './render';
	import { saveGuide } from './save';
	import SortableSection from './SortableSection.svelte';
	import TextField from './TextField.svelte';
	import type { GuideQuestion } from './types';

	let {
		guide: initialGuide,
		lang,
		projectName = '',
		availableLanguages = [],
		externalParams = [],
		revision = null
	} = $props<{
		guide: LocalizedInterviewGuide | null;
		lang: string;
		projectName?: string;
		availableLanguages?: ProjectLanguage[];
		externalParams?: ExternalParam[];
		/** The content revision the guide was loaded at (its `ETag`). */
		revision?: string | null;
	}>();

	const guideStore = getGuideStore();

	// State
	let saving = $state(false);
	let exporting = $state(false);
	let translating = $state(false);

	function applyGuide(next: LocalizedInterviewGuide | null) {
		const mapped = mapToLocal(next ?? {});
		if (mapped.sections.length === 0) {
			const section = newSection();
			mapped.sections.push(section);
			mapped.questions[section.id] = [];
		}

		// Initialize the shared store
		guideStore.localSections = mapped.sections;
		guideStore.localQuestions = mapped.questions;
		guideStore.top = mapped.top;
	}

	// svelte-ignore state_referenced_locally
	applyGuide(initialGuide);

	function getSnapshot() {
		return JSON.stringify({
			top: guideStore.top,
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

	let languageName = $derived(
		availableLanguages.find((l: ProjectLanguage) => l.code === lang)?.name ?? lang
	);
	let defaultLanguageName = $derived(
		availableLanguages.find((l: ProjectLanguage) => l.code === guideStore.defaultLang)?.name ??
			guideStore.defaultLang
	);
	let untranslated = $derived(
		countUntranslated(guideStore.top, guideStore.localSections, guideStore.localQuestions, lang)
	);

	let projectId = $state(page.params.project_id ?? '');

	// Adopted once, at mount: the revision the content on screen was loaded
	// at. Later ones come only from this page's own saves, so reloading the
	// page data (which the parent keys this component on) cannot make stale
	// edits look current.
	onMount(() => contentRevision.set(projectId, revision));
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);

	// Modal state
	let showBulkSettingsModal = $state(false);
	let showGenerateGuideModal = $state(false);
	let showGenerateSectionModal = $state(false);
	let showGenerateQuestionModal = $state(false);
	let generatingQuestionSectionId = $state<string | null>(null);

	let activeId = $state('');

	async function handleGenerateGuide(prompt: string) {
		const { data, error, response } = await Projects.generateGuide({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});
		if (error || !data) {
			console.error('Failed to generate guide', error);
			toast.error('Failed to generate guide');
			return;
		}
		// The generated guide is already persisted server-side and replaces the
		// guide in every language; the others show as untranslated.
		contentRevision.take(projectId, response);
		applyGuide(data);
		savedSnapshot = getSnapshot();
	}

	async function handleGenerateSection(prompt: string) {
		const { data, error } = await Projects.generateGuideSection({
			path: { project_id: projectId, lang: lang },
			body: { prompt }
		});

		if (error || !data) {
			console.error('Failed to generate section', error);
			toast.error('Failed to generate section');
			return;
		}

		addLocalSections([data], guideStore.localSections, guideStore.localQuestions);
	}

	async function handleGenerateQuestion(prompt: string) {
		const sectionId = generatingQuestionSectionId;
		if (!sectionId) return;

		const { data, error, response } = await Projects.generateSectionQuestion({
			path: { project_id: projectId, lang: lang },
			body: { prompt, section_id: sectionId }
		});

		if (error || !data) {
			console.error('Failed to generate question', error);
			// The server generates against the saved guide, which a section added
			// since the last save is not in yet.
			toast.error(
				response?.status === 404
					? 'Save the guide before generating questions for a new section'
					: 'Failed to generate question'
			);
			return;
		}

		if (!guideStore.localQuestions[sectionId]) {
			guideStore.localQuestions[sectionId] = [];
		}
		guideStore.localQuestions[sectionId].push(
			localQuestion(data, guideStore.localSections, guideStore.localQuestions)
		);

		generatingQuestionSectionId = null;
	}

	async function save(): Promise<boolean> {
		saving = true;
		const result = await saveGuide(
			projectId,
			guideStore.top,
			guideStore.localSections,
			guideStore.localQuestions,
			externalParams
		);
		saving = false;
		if (result.status === 'stale') return false;
		if (result.status === 'invalid') {
			guideStore.invalidConditionQuestionIds = result.invalidQuestionIds;
			toast.error(
				'Some conditions reference a later question or section, or an option that is gone. Please fix the highlighted conditions.'
			);
			return false;
		}
		if (result.status === 'error') {
			console.error('Failed to save guide', result.error);
			toast.error('Failed to save guide');
			return false;
		}
		guideStore.invalidConditionQuestionIds = [];
		savedSnapshot = getSnapshot();
		toast.success('Guide saved');
		return true;
	}

	// Machine-translates what this language lacks, from the default language.
	// The server translates the saved guide, so unsaved edits are saved first.
	async function translateMissing() {
		if (getSnapshot() !== savedSnapshot && !(await save())) return;
		translating = true;
		const { data, error, response } = await Projects.translateMissing({
			path: { project_id: projectId, lang }
		});
		contentRevision.take(projectId, response);
		translating = false;
		if (error || !data) {
			console.error('Failed to translate', error);
			toast.error('Failed to translate the missing text');
			return;
		}
		applyGuide(data.guide);
		savedSnapshot = getSnapshot();
		toast.success(`Translated the missing ${languageName} text`);
	}

	function addTimedMessage() {
		guideStore.top.timed_messages.push({
			message: {},
			time: 0,
			include_in_history: false,
			as_modal: false
		});
	}

	function removeTimedMessage(index: number) {
		guideStore.top.timed_messages.splice(index, 1);
	}

	function addSection() {
		const section = newSection();
		guideStore.localSections.push(section);
		guideStore.localQuestions[section.id] = [];
	}

	function removeSection(index: number) {
		const section = guideStore.localSections[index];
		if (!section) return;

		const description = pick(section.description, guideStore.languages).trim().split('\n')[0];
		const label =
			description.length > 60
				? `Section ${index + 1}: "${description.slice(0, 60)}\u2026"`
				: description
					? `Section ${index + 1}: "${description}"`
					: `Section ${index + 1}`;
		const questionCount = guideStore.localQuestions[section.id]?.length ?? 0;
		const questionNote = questionCount
			? ` and its ${questionCount} question${questionCount === 1 ? '' : 's'}`
			: '';

		if (
			confirm(
				`Are you sure you want to delete ${label}${questionNote}? It is removed in every language.`
			)
		) {
			const [removed] = guideStore.localSections.splice(index, 1);
			delete guideStore.localQuestions[removed.id];
		}
	}

	let totalQuestions = $derived(
		Object.values(guideStore.localQuestions).reduce((n, qs) => n + qs.length, 0)
	);

	function applyBulkSettings(changes: Partial<GuideQuestion>) {
		let updated = 0;
		for (const section of guideStore.localSections) {
			for (const q of guideStore.localQuestions[section.id] ?? []) {
				Object.assign(q, changes);
				updated++;
			}
		}
		toast.success(`Updated ${updated} question${updated === 1 ? '' : 's'}`);
	}

	let showExportPdfModal = $state(false);

	async function fetchConsent(): Promise<Consent | null> {
		// The draft's, like the guide being exported.
		const { data } = await Projects.getConsent({
			path: { project_id: projectId, language: lang },
			query: { draft: true }
		});
		return data ?? null;
	}

	async function fetchWelcome(): Promise<Welcome | null> {
		const { data } = await Projects.getWelcome({
			path: { project_id: projectId, language: lang },
			query: { draft: true }
		});
		return data ?? null;
	}

	function rendered() {
		return renderLocal(
			guideStore.top,
			guideStore.localSections,
			guideStore.localQuestions,
			guideStore.languages
		);
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const [consent, welcome] = await Promise.all([
				toggles.consent ? fetchConsent() : Promise.resolve(null),
				toggles.welcome ? fetchWelcome() : Promise.resolve(null)
			]);
			const { guide, sections, questions } = rendered();
			await downloadGuidePdf({
				guide,
				sections,
				questions,
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
				interview_guide: rendered().guide,
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

<!-- `print-guide` scopes this route's print rules in `app.css`. They shape the
     guide specifically -- hiding its edit affordances, flattening its
     textareas -- and used to be written unscoped, which left them reaching
     into every other printable route. -->
<div class="print-guide">
	<div class="flex justify-between">
		<h1 class="page-title">Interview Guide</h1>
		<div class="mb-2 flex gap-2">
			<button
				data-tour="bulk-settings"
				class="rounded-full bg-gray-100 px-6 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
				onclick={() => (showBulkSettingsModal = true)}
				disabled={totalQuestions === 0}
				title={totalQuestions === 0 ? 'Add a question first' : 'Edit settings for all questions'}
			>
				<i class="fa-solid fa-sliders"></i>
				Bulk settings
			</button>
			<button
				data-tour="generate"
				class="rounded-full bg-secondary px-6 font-medium text-gray-700 hover:brightness-95"
				onclick={() => (showGenerateGuideModal = true)}
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i>
				Generate
			</button>
		</div>
	</div>

	<p class="mb-6 text-gray-600">
		On this page, you can create an interview guide that will be used by AInterviewer to conduct the
		model. The interview guide consists of different components with different settings.
	</p>

	<TranslationBanner
		{languageName}
		{defaultLanguageName}
		isDefault={lang === guideStore.defaultLang}
		{untranslated}
		{translating}
		disabled={saving}
		onTranslate={translateMissing}
	/>

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
				<TextField
					multiline
					class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
					text={guideStore.top.framing}
				/>
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
				<TextField
					multiline
					class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
					text={guideStore.top.introduction}
				/>
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
			<div
				data-tour="ai-generated-sections"
				class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<div class="flex items-center gap-3">
					<label class="text-sm font-medium text-gray-700" for="ai-generated-sections">
						AI Generated Sections
					</label>
					<input
						id="ai-generated-sections"
						type="number"
						min="0"
						class="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
						bind:value={guideStore.top.ai_generated_sections}
					/>
					<HoverInfo
						text="Specifies the number of sections that will be automatically generated once the predefined ones are finished."
					/>
				</div>
			</div>

			<!-- Outro -->
			<div
				data-tour="outro"
				id="outro"
				class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<h3 class="mb-2 text-lg font-medium">Outro</h3>
				<p class="mb-4 text-sm text-gray-500">Last message in the interview.</p>
				<TextField
					multiline
					class="h-32 w-full rounded-md border border-gray-300 p-3 focus:border-primary focus:ring-2 focus:ring-primary"
					text={guideStore.top.outro}
				/>
			</div>

			<!-- Timed Messages -->
			<div
				data-tour="timed-messages"
				id="timed_messages"
				class="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<h3 class="mb-2 text-lg font-medium">Timed Messages</h3>
				<p class="mb-4 text-sm text-gray-500">
					Schedule messages to be sent to the interviewee during the interview after a specified
					number of seconds.
				</p>

				<div class="space-y-4">
					{#each guideStore.top.timed_messages as tm, i (i)}
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
									<TextField
										multiline
										id="tm-message-{i}"
										class="h-20 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
										text={tm.message}
									/>
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
				onSave={save}
				onExportPdf={() => {
					showExportPdfModal = true;
				}}
				onExportJson={exportJson}
			/>
		</div>
	</div>
</div>

<BulkSettingsModal
	bind:open={showBulkSettingsModal}
	questionCount={totalQuestions}
	onApply={applyBulkSettings}
/>

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
