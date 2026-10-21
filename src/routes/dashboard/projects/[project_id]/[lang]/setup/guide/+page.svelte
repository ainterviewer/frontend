<script lang="ts">
	import 'driver.js/dist/driver.css';

	import { move } from '@dnd-kit/helpers';
	import {
		type DragDropEvents,
		DragDropProvider,
		DragOverlay,
		KeyboardSensor,
		PointerSensor
	} from '@dnd-kit-svelte/svelte';
	import { driver } from 'driver.js';
	import { onMount, tick } from 'svelte';

	import AssistanceChat from '$lib/components/AssistanceChat.svelte';
	import { addSkipOnboardingButton, tourSteps } from '$lib/onboarding';
	import {
		createGuideStore,
		type GuideQuestion,
		type GuideSection,
		setGuideStore
	} from '$lib/stores/guideStore.svelte';

	import { dragState } from './dragState.svelte';
	import InterviewGuide from './InterviewGuide.svelte';
	import { renderLocal } from './render';
	import SortableQuestion from './SortableQuestion.svelte';
	import SortableSection from './SortableSection.svelte';

	// The steps a user who took the tour before steps had ids has seen.
	const LEGACY_TOUR_STEPS = [
		'intro',
		'generate',
		'bulk-settings',
		'assistant-chat',
		'framing',
		'introduction',
		'section',
		'question',
		'question-settings',
		'question-settings-menu',
		'question-extras',
		'probes',
		'probing-limits',
		'behavior-flags',
		'ai-generated-questions',
		'ai-generated-sections',
		'outro',
		'timed-messages',
		'sync-state',
		'action-bar',
		'language',
		'export',
		'version-history',
		'try-interview',
		'publish',
		'done'
	];

	function startOnboarding() {
		const steps = tourSteps(
			'guide',
			[
				{
					id: 'intro',
					popover: {
						title: 'Interview Guide',
						description:
							'The interview guide is the heart of your interview project. Configure and tweak the different elements to match your own needs.'
					}
				},
				{
					id: 'generate',
					element: '[data-tour="generate"]',
					popover: {
						title: 'Generate Interview Guide',
						description:
							'Describe your theme and requirements, and have the AI draft an interview guide you can use as an inspiration for your interview guide.'
					}
				},
				{
					id: 'bulk-settings',
					element: '[data-tour="bulk-settings"]',
					popover: {
						title: 'Bulk Settings',
						description:
							'Change a setting once and apply it to every question at the same time. Enable just the probing limits or behavior flags you want to update — everything you leave off keeps its per-question value.'
					}
				},
				{
					id: 'assistant-chat',
					element: '[data-tour="assistant-chat"]',
					popover: {
						title: 'AI Assistant (experimental)',
						description:
							'You can also use our interactive AI assistant to iterate and develop your interview guide.'
					}
				},
				{
					id: 'framing',
					element: '[data-tour="framing"]',
					popover: {
						title: 'Framing',
						description:
							'Set the scene and provide background for your interview. This is never shown to the interviewee — it only helps the AI ask more relevant questions.'
					}
				},
				{
					id: 'introduction',
					element: '[data-tour="introduction"]',
					popover: {
						title: 'Introduction',
						description:
							'Here you write the first message the interviewees will receive in the chat. Use the message to welcome the interviewee and introduce your study. The message cannot be replied to.'
					}
				},
				{
					id: 'section',
					element: '[data-tour="section"]',
					popover: {
						title: 'Sections',
						description:
							'Organize your questions into sections. Each section has its own description, can be shuffled, and can be extended with AI-generated questions.'
					}
				},
				{
					id: 'question',
					element: '[data-tour="question"]',
					popover: {
						title: 'Questions',
						description:
							'These are the questions the AInterviewer will ask. Each question consists of a description, which is helps the AInterviewer to formulate relevant follow-up probes, and a main question, which is a primary question of interest. Drag them to reorder, and expand the settings to fine-tune how each one behaves.'
					}
				},
				{
					id: 'question-settings',
					element: '[data-tour="question-settings"]',
					popover: {
						title: 'Question Settings',
						description:
							"Open a question's settings to add follow-up probes, attach media or survey items, set probing limits, and tweak its behavior.",
						onNextClick: () => {
							// The settings menu element only renders once the settings panel is
							// open, so open it before advancing to the next step.
							if (!document.querySelector('[data-tour="question-settings-menu"]')) {
								(
									document.querySelector('[data-tour="question-settings"]') as HTMLElement | null
								)?.click();
							}
							// Wait for the slide transition (200ms) to settle so driver.js can
							// measure the element correctly.
							setTimeout(() => tour.moveNext(), 300);
						}
					}
				},
				{
					id: 'question-settings-menu',
					element: '[data-tour="question-settings-menu"]',
					popover: {
						title: 'Question Settings',
						description:
							"This panel holds all the advanced options for a single question. Let's walk through what you can configure here."
					}
				},
				{
					id: 'question-extras',
					element: '[data-tour="question-extras"]',
					popover: {
						title: 'Add Extras',
						description:
							'Enrich a question by attaching an image, adding a survey item for structured answers, or setting a condition that controls when the question is shown.'
					}
				},
				{
					id: 'probes',
					element: '[data-tour="probes"]',
					popover: {
						title: 'Follow-up Probes',
						description:
							'Add follow-up questions the AInterviewer can use to dig deeper when an answer needs more detail.'
					}
				},
				{
					id: 'probing-limits',
					element: '[data-tour="probing-limits"]',
					popover: {
						title: 'Probing Limits',
						description:
							'Keep probing in check by capping the number of follow-ups and the time spent on a single question.'
					}
				},
				{
					id: 'behavior-flags',
					element: '[data-tour="behavior-flags"]',
					popover: {
						title: 'Behavior Flags',
						description:
							'Toggle how a question behaves — exclude it from history, create a transition from the previous question, reformulate a question that was already answered, and more.',
						onNextClick: () => {
							// The settings menu element only renders once the settings panel is
							// open, so open it before advancing to the next step.
							if (document.querySelector('[data-tour="question-settings-menu"]')) {
								(
									document.querySelector('[data-tour="question-settings"]') as HTMLElement | null
								)?.click();
							}
							// Wait for the slide transition (200ms) to settle so driver.js can
							// measure the element correctly.
							setTimeout(() => tour.moveNext(), 300);
						}
					}
				},
				{
					id: 'ai-generated-questions',
					element: '[data-tour="ai-generated-questions"]',
					popover: {
						title: 'AI Generated Questions',
						description:
							"Once a section's predefined questions are done, the AInterviewer can generate extra questions on the fly. Specify how many you want, and cap the probing for each."
					}
				},
				{
					id: 'ai-generated-sections',
					element: '[data-tour="ai-generated-sections"]',
					popover: {
						title: 'AI Generated Sections',
						description:
							'After all your predefined sections are finished, the AInterviewer can spin up additional sections automatically. Set how many to allow.'
					}
				},
				{
					id: 'outro',
					element: '[data-tour="outro"]',
					popover: {
						title: 'Outro',
						description:
							'Write the closing message your interviewee sees when the interview ends. Use it to thank them and wrap things up.'
					}
				},
				{
					id: 'timed-messages',
					element: '[data-tour="timed-messages"]',
					popover: {
						title: 'Timed Messages',
						description:
							'Schedule messages to appear during the interview after a set number of seconds — handy for gentle nudges, reminders, or extra context.'
					}
				},
				{
					id: 'sync-state',
					element: '[data-tour="sync-state"]',
					popover: {
						title: 'Saved as you type',
						description:
							'Your changes are saved as you make them. This shows whether everything is saved, and who else is editing with you right now.'
					}
				},
				{
					id: 'action-bar',
					element: '[data-action-bar]',
					popover: {
						title: 'Action Bar',
						description:
							'This bar stays within reach as you scroll. Each action is explained in the next steps.'
					}
				},
				{
					id: 'language-v2',
					element: '[data-tour="language"]',
					popover: {
						title: 'Language',
						description:
							'Switch between the languages your project supports, or add a new one. Every language shares the same questions and settings; switching changes only the text you edit. Mark a language as <u>in progress</u> while it is being translated: publishing leaves it out, and its missing text does not block publishing.'
					}
				},
				{
					id: 'export',
					element: '[data-tour="export"]',
					popover: {
						title: 'Export',
						description:
							'Download your interview guide as a PDF for sharing or review, or as JSON to back it up and move it between projects.'
					}
				},
				{
					id: 'version-history',
					element: '[data-tour="version-history"]',
					popover: {
						title: 'Version History',
						description:
							'Shows the version respondents see now. A dot means the draft has changes they do not see yet. Open it to browse earlier versions and restore one.'
					}
				},
				{
					id: 'try-interview',
					element: '[data-tour="try-interview"]',
					popover: {
						title: 'Try Interview',
						description:
							'Launch a test run of the draft in a new tab to experience the interview as your interviewee would, without affecting your real data.'
					}
				},
				{
					id: 'publish',
					element: '[data-tour="publish"]',
					popover: {
						title: 'Publish',
						description:
							'Your edits stay a draft until you publish. Publishing makes the draft the version respondents see when you send them the interview: the guide along with the consent, welcome screen, agents and emails, in every language.'
					}
				},
				{
					id: 'done',
					element: '[data-tour="documentation"]',
					onHighlightStarted: () => {
						// Scroll back to the top for the final, centered step. The page
						// content scrolls inside the dashboard <main>, not the window.
						document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
					},
					popover: {
						title: "That's it for the Interview Guide!",
						description:
							"We'll let you poke around on your own now. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
						popoverClass: 'driver-centered'
					}
				}
			],
			LEGACY_TOUR_STEPS
		);
		if (steps.length === 0) return;
		const tour = driver({
			showProgress: true,
			onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
			steps
		});
		tour.drive();
	}

	onMount(() => {
		// The whole tour on a first visit, then only steps added since; nothing
		// if the user opted out of all tours.
		startOnboarding();
	});

	let { data } = $props();

	let defaultLang = $derived(
		data.available_languages.find((language) => language.is_default)?.code ?? data.lang
	);

	const guideStore = setGuideStore(
		createGuideStore(
			() => data.lang,
			() => defaultLang
		)
	);

	// The assistant reads the guide as the language being edited sees it.
	let renderedGuide = $derived(
		renderLocal(
			guideStore.top,
			guideStore.localSections,
			guideStore.localQuestions,
			guideStore.languages
		).guide
	);

	const sensors = [KeyboardSensor, PointerSensor];

	type DragEventOf<K extends 'dragover' | 'dragstart' | 'dragend'> = Parameters<
		DragDropEvents[K]
	>[0];

	let activeItem = $state<GuideSection | GuideQuestion | null>(null);
	let activeDragType = $state<'section' | 'question' | null>(null);
	let isChatMaximized = $state(false);
	let pointerY = 0;

	$effect(() => {
		dragState.draggingType = activeDragType;
	});

	function arrayMove<T>(array: T[], from: number, to: number): T[] {
		const newArray = array.slice();
		newArray.splice(to, 0, newArray.splice(from, 1)[0]);
		return newArray;
	}

	function handleDragOver(event: DragEventOf<'dragover'>) {
		const { source, target } = event.operation;
		if (!source) return;

		// Chat-sourced items: track hover target for visual feedback, skip move logic
		if (source.data?.source === 'chat') {
			if (!target) {
				dragState.chatDropTarget = null;
				return;
			}

			// Determine before/after based on pointer Y vs element midpoint.
			// Only applies for question-on-question and section-on-section drops;
			// question-on-section always appends (position unused for that case).
			let position: 'before' | 'after' = 'before';
			const needsPosition =
				(source.type === 'question' && target.type === 'question') ||
				(source.type === 'section' && target.type === 'section');
			if (needsPosition) {
				const el = document.getElementById(String(target.id));
				if (el) {
					const rect = el.getBoundingClientRect();
					position = pointerY > rect.top + rect.height / 2 ? 'after' : 'before';
				}
			}

			dragState.chatDropTarget = {
				id: String(target.id),
				targetType: target.type as 'section' | 'question',
				dragType: source.type as 'section' | 'question',
				position
			};
			return;
		}

		if (!target) return;

		if (source.type === 'section') {
			if (target.type === 'section' && source.id !== target.id) {
				const oldIndex = guideStore.localSections.findIndex((s) => s.id === source.id);
				const newIndex = guideStore.localSections.findIndex((s) => s.id === target.id);
				if (oldIndex !== -1 && newIndex !== -1) {
					guideStore.localSections = arrayMove(guideStore.localSections, oldIndex, newIndex);
				}
			}
			return;
		}

		// @dnd-kit/helpers ships its own copy of @dnd-kit/abstract, so its event
		// type is nominally incompatible with ours despite being identical.
		guideStore.localQuestions = move(
			guideStore.localQuestions,
			event as unknown as Parameters<typeof move>[1]
		);
	}

	function handleDragStart(event: DragEventOf<'dragstart'>) {
		const source = event.operation.source;
		const data = source?.data;
		const type = source?.type as 'section' | 'question' | undefined;
		activeDragType = type ?? null;
		const sourceId = source?.id;
		if (sourceId) {
			dragState.draggingId = String(sourceId);
		}
		if (data?.source === 'chat') {
			isChatMaximized = false;
		}
		if (type === 'section') {
			activeItem = data?.section;
		} else if (type === 'question') {
			activeItem = data?.question;
		}
	}

	async function handleDragEnd(event: DragEventOf<'dragend'>) {
		const { source, target } = event.operation;

		// Track the id of the element to scroll to after the drop.
		// For guide-sourced drags this is the original element; for chat-sourced
		// drags we update it to the newly created element below.
		let scrollTargetId = dragState.draggingId;

		if (source?.data?.source === 'chat' && target) {
			const chatData = source.data;

			if (chatData.type === 'question' && chatData.question) {
				let targetSectionId: string | undefined;
				let insertIdx: number | undefined;

				if (target.type === 'question') {
					targetSectionId = target.data?.sectionId;
					if (targetSectionId) {
						const idx = guideStore.localQuestions[targetSectionId]?.findIndex(
							(q) => q.id === target.id
						);
						if (idx !== undefined && idx !== -1) {
							const position = dragState.chatDropTarget?.position ?? 'before';
							insertIdx = position === 'after' ? idx + 1 : idx;
						}
					}
				} else if (target.type === 'section') {
					targetSectionId = String(target.id);
				}

				if (targetSectionId) {
					const newQ: GuideQuestion = { ...chatData.question, id: crypto.randomUUID() };
					if (!guideStore.localQuestions[targetSectionId]) {
						guideStore.localQuestions[targetSectionId] = [];
					}
					if (insertIdx !== undefined) {
						guideStore.localQuestions[targetSectionId].splice(insertIdx, 0, newQ);
					} else {
						guideStore.localQuestions[targetSectionId].push(newQ);
					}
					scrollTargetId = newQ.id;
				}
			} else if (chatData.type === 'section' && chatData.section) {
				const src = chatData.section as GuideSection;
				const srcQuestions: GuideQuestion[] = chatData.questions || [];
				const newId = crypto.randomUUID();
				const newSection: GuideSection = { ...src, id: newId, questions: [] };

				let insertIdx = guideStore.localSections.length;
				if (target.type === 'section') {
					const idx = guideStore.localSections.findIndex((s) => s.id === target.id);
					if (idx !== -1) {
						const position = dragState.chatDropTarget?.position ?? 'before';
						insertIdx = position === 'after' ? idx + 1 : idx;
					}
				}

				guideStore.localSections.splice(insertIdx, 0, newSection);
				guideStore.localQuestions[newId] = srcQuestions.map((q) => ({
					...q,
					id: crypto.randomUUID()
				}));
				scrollTargetId = newId;
			}
		}

		// --- Scroll compensation ---
		// During drag, items are collapsed to max-height: 19rem so the list is
		// compact and easier to navigate. When the drag ends the max-height is
		// removed and items expand back to their full size, which shifts the
		// viewport. To counteract this we:
		// 1. Keep CSS transitions disabled so the height change is instant.
		// 2. Wait for Svelte to flush DOM updates (tick) + one animation frame.
		// 3. Scroll the dropped element back into view.
		// 4. Re-enable transitions only after the smooth scroll finishes.
		dragState.keepTransitionsDisabled = true;

		activeItem = null;
		activeDragType = null;
		dragState.chatDropTarget = null;

		if (scrollTargetId) {
			// Wait for Svelte reactivity to flush DOM changes, then one frame
			// for the browser to lay out the expanded elements.
			await tick();
			requestAnimationFrame(() => {
				const el = document.getElementById(scrollTargetId);
				if (el) {
					el.scrollIntoView({ block: 'start', behavior: 'smooth' });

					// Re-enable transitions after the scroll finishes so the
					// height snap doesn't animate. Fall back to a timeout for
					// browsers that don't support scrollend.
					const scrollContainer = document.scrollingElement ?? document.documentElement;
					let settled = false;
					const settle = () => {
						if (settled) return;
						settled = true;
						dragState.draggingId = null;
						dragState.keepTransitionsDisabled = false;
					};
					scrollContainer.addEventListener('scrollend', settle, { once: true });
					setTimeout(settle, 600);
				} else {
					dragState.draggingId = null;
					dragState.keepTransitionsDisabled = false;
				}
			});
		} else {
			dragState.draggingId = null;
			dragState.keepTransitionsDisabled = false;
		}
	}
</script>

<svelte:window onpointermove={(e) => (pointerY = e.clientY)} />

{#key `${data.project_id}-${data.lang}`}
	<DragDropProvider
		{sensors}
		onDragOver={handleDragOver}
		onDragStart={handleDragStart}
		onDragEnd={handleDragEnd}
	>
		<InterviewGuide
			guide={data.guide}
			lang={data.lang}
			projectName={data.project_name}
			availableLanguages={data.available_languages}
			externalParams={data.external_params}
		/>

		<AssistanceChat
			project_id={data.project_id}
			lang={data.lang}
			guide={renderedGuide}
			bind:isMaximized={isChatMaximized}
		>
			{#snippet questionMessage(item: GuideQuestion, msgIndex: number)}
				<SortableQuestion
					question={item}
					sectionId="chat"
					sectionIndex={0}
					index={msgIndex}
					source="chat"
					allSections={guideStore.localSections}
					allQuestions={guideStore.localQuestions}
					onRemove={() => {}}
				/>
			{/snippet}

			{#snippet sectionMessage(
				item: { section: GuideSection; questions: GuideQuestion[] },
				msgIndex: number
			)}
				<SortableSection
					section={item.section}
					questions={item.questions}
					sectionIndex={msgIndex}
					source="chat"
					allSections={guideStore.localSections}
					allQuestions={guideStore.localQuestions}
					onRemove={() => {}}
				/>
			{/snippet}
		</AssistanceChat>

		<DragOverlay>
			{#snippet children(active)}
				{#if activeItem}
					{#if active.data.current?.type === 'section'}
						<SortableSection
							section={activeItem as GuideSection}
							questions={guideStore.localQuestions[(activeItem as GuideSection).id] || []}
							sectionIndex={guideStore.localSections.findIndex((s) => s.id === activeItem?.id) ?? 0}
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
{/key}
