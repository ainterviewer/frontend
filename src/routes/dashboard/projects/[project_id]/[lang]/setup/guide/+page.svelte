<script lang="ts">
	import AssistanceChat from '$lib/components/AssistanceChat.svelte';
	import { addSkipOnboardingButton, isOnboardingDisabled } from '$lib/onboarding';
	import {
		createGuideStore,
		setGuideStore,
		type GuideQuestion,
		type GuideSection
	} from '$lib/stores/guideStore.svelte';
	import {
		DragDropProvider,
		DragOverlay,
		KeyboardSensor,
		PointerSensor,
		type DragDropEvents
	} from '@dnd-kit-svelte/svelte';
	import { move } from '@dnd-kit/helpers';
	import { driver } from 'driver.js';
	import 'driver.js/dist/driver.css';
	import { onMount, tick } from 'svelte';
	import { dragState } from './dragState.svelte';
	import InterviewGuide from './InterviewGuide.svelte';
	import SortableQuestion from './SortableQuestion.svelte';
	import SortableSection from './SortableSection.svelte';

	function startOnboarding() {
		const tour = driver({
			showProgress: true,
			onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
			steps: [
				{
					popover: {
						title: 'Interview Guide',
						description:
							'The interview guide is the heart of your interviews. Configure and tweak the different elements to your own needs.'
					}
				},
				{
					element: '[data-tour="generate"]',
					popover: {
						title: 'Generate<br>Interview Guide',
						description:
							'Describe your theme and requirements, and have the AI draft an interview guide you can use as a inspiration for your interviews.'
					}
				},
				{
					element: '[data-tour="assistant-chat"]',
					popover: {
						title: 'AI Assistant (experimental)',
						description:
							'You can also use our interactive AI assistant to iterate and develop your interview guide.'
					}
				},
				{
					element: '[data-tour="framing"]',
					popover: {
						title: 'Framing',
						description:
							'Set the scene and provide background for your interview. This is never shown to the interviewee — it only helps the AI ask more relevant questions.'
					}
				},
				{
					element: '[data-tour="introduction"]',
					popover: {
						title: 'Introduction',
						description:
							'Write the opening message your interviewee will see. It welcomes them to the interview and cannot be replied to.'
					}
				},
				{
					element: '[data-tour="section"]',
					popover: {
						title: 'Sections',
						description:
							'Organize your questions into sections. Each section has its own description, can be shuffled, and can be topped up with AI-generated questions.'
					}
				},
				{
					element: '[data-tour="question"]',
					popover: {
						title: 'Questions',
						description:
							'These are the questions the AInterviewer will ask. Drag them to reorder, and expand the settings to fine-tune how each one behaves.'
					}
				},
				{
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
					element: '[data-tour="question-settings-menu"]',
					popover: {
						title: 'Question Settings',
						description:
							"This panel holds all the advanced options for a single question. Let's walk through what you can configure here."
					}
				},
				{
					element: '[data-tour="question-extras"]',
					popover: {
						title: 'Add Extras',
						description:
							'Enrich a question by attaching an image, adding a survey item for structured answers, or setting a condition that controls when the question is shown.'
					}
				},
				{
					element: '[data-tour="probes"]',
					popover: {
						title: 'Follow-up Probes',
						description:
							'Add follow-up questions the AInterviewer can use to dig deeper when an answer needs more detail.'
					}
				},
				{
					element: '[data-tour="probing-limits"]',
					popover: {
						title: 'Probing Limits',
						description:
							'Keep probing in check by capping the number of follow-ups and the time spent on a single question.'
					}
				},
				{
					element: '[data-tour="behavior-flags"]',
					popover: {
						title: 'Behavior Flags',
						description:
							'Toggle how a question behaves — exclude it from history, create a transition from the previous question, check whether it was already answered, and more.',
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
					element: '[data-tour="ai-generated-questions"]',
					popover: {
						title: 'AI Generated Questions',
						description:
							"Once a section's predefined questions are done, the AInterviewer can generate extra questions on the fly. Set how many, and cap the probing for each."
					}
				},
				{
					element: '[data-tour="ai-generated-sections"]',
					popover: {
						title: 'AI Generated Sections',
						description:
							'After all your predefined sections are finished, the AInterviewer can spin up additional sections automatically. Set how many to allow.'
					}
				},
				{
					element: '[data-tour="outro"]',
					popover: {
						title: 'Outro',
						description:
							'Write the closing message your interviewee sees when the interview ends. Use it to thank them and wrap things up.'
					}
				},
				{
					element: '[data-tour="timed-messages"]',
					popover: {
						title: 'Timed Messages',
						description:
							'Schedule messages to appear during the interview after a set number of seconds — handy for gentle nudges, reminders, or extra context.'
					}
				},
				{
					element: '[data-action-bar]',
					popover: {
						title: 'Action Bar',
						description:
							'This bar stays within reach as you scroll. From here you can switch language, preview the interview, export your guide, and save your changes.'
					}
				},
				{
					element: '[data-tour="language"]',
					popover: {
						title: 'Language',
						description:
							'Switch between the languages your project supports, or add a new one. Each language has its own interview guide.'
					}
				},
				{
					element: '[data-tour="try-interview"]',
					popover: {
						title: 'Try Interview',
						description:
							'Launch a test run in a new tab to experience the interview exactly as your interviewee would, without affecting your real data.'
					}
				},
				{
					element: '[data-tour="export"]',
					popover: {
						title: 'Export',
						description:
							'Download your interview guide as a PDF for sharing or review, or as JSON to back it up and move it between projects.'
					}
				},
				{
					element: '[data-tour="save"]',
					popover: {
						title: 'Save Changes',
						description:
							"Persist your edits. Don't forget to save — you'll be warned if you try to leave the page with unsaved changes."
					}
				},
				{
					element: '[data-tour="documentation"]',
					onHighlightStarted: () => {
						// Scroll back to the top for the final, centered step. The page
						// content scrolls inside the dashboard <main>, not the window.
						document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
					},
					popover: {
						title: "That's it for the Interview Guide!",
						description:
							"We'll let you poke around now on your own now. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
						popoverClass: 'driver-centered'
					}
				}
			]
		});
		tour.drive();
	}

	onMount(() => {
		// Show the onboarding tour once per user, unless they opted out of all tours.
		if (!isOnboardingDisabled() && !localStorage.getItem('guide-onboarded')) {
			startOnboarding();
			localStorage.setItem('guide-onboarded', 'true');
		}
	});

	let { data } = $props();

	const guideStore = setGuideStore(createGuideStore());

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
			guide={guideStore.guide ?? data.guide}
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
