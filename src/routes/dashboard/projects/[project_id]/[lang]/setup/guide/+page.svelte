<script lang="ts">
	import {
		DragDropProvider,
		DragOverlay,
		KeyboardSensor,
		PointerSensor
	} from '@dnd-kit-svelte/svelte';
	import { move } from '@dnd-kit/helpers';
	import { tick } from 'svelte';
	import AssistanceChat from '$lib/components/AssistanceChat.svelte';
	import { guideStore, type GuideQuestion, type GuideSection } from '$lib/stores/guideStore.svelte';
	import { dragState } from './dragState.svelte';
	import InterviewGuide from './InterviewGuide.svelte';
	import SortableQuestion from './SortableQuestion.svelte';
	import SortableSection from './SortableSection.svelte';

	let { data } = $props();

	const sensors = [KeyboardSensor, PointerSensor];

	let activeItem = $state<GuideSection | GuideQuestion | null>(null);
	let activeDragType = $state<'section' | 'question' | null>(null);

	$effect(() => {
		dragState.draggingType = activeDragType;
	});

	function arrayMove<T>(array: T[], from: number, to: number): T[] {
		const newArray = array.slice();
		newArray.splice(to, 0, newArray.splice(from, 1)[0]);
		return newArray;
	}

	function handleDragOver(event: any) {
		const { source, target } = event.operation;

		// Chat-sourced items: track hover target for visual feedback, skip move logic
		if (source.data?.source === 'chat') {
			dragState.chatDropTarget = target
				? { id: target.id, targetType: target.type, dragType: source.type }
				: null;
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

		guideStore.localQuestions = move(guideStore.localQuestions as any, event);
	}

	function handleDragStart(event: any) {
		const source = event.operation?.source;
		const data = source?.data ?? source?.current?.data;
		const type = source?.type ?? source?.current?.type;
		activeDragType = type ?? null;
		const sourceId = source?.id ?? source?.current?.id;
		if (sourceId) {
			dragState.draggingId = sourceId;
		}
		if (type === 'section') {
			activeItem = data?.section;
		} else if (type === 'question') {
			activeItem = data?.question;
		}
	}

	async function handleDragEnd(event: any) {
		const { source, target } = event.operation ?? {};

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
						if (idx !== undefined && idx !== -1) insertIdx = idx;
					}
				} else if (target.type === 'section') {
					targetSectionId = target.id;
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
					if (idx !== -1) insertIdx = idx;
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

<DragDropProvider
	{sensors}
	onDragOver={handleDragOver}
	onDragStart={handleDragStart}
	onDragEnd={handleDragEnd}
>
	{#key data.guide}
		<InterviewGuide guide={data.guide} lang={data.lang} />
	{/key}

	<AssistanceChat project_id={data.project_id} lang={data.lang}>
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
