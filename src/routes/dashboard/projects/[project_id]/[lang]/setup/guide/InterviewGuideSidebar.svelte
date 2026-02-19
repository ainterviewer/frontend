<script lang="ts">
	import { guideStore } from '$lib/stores/guideStore.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	let { activeId, localSections, localQuestions } = $props<{
		activeId: string;
		localSections: GuideSection[];
		localQuestions: Record<string, GuideQuestion[]>;
	}>();

	let draggingType = $state<'section' | 'question' | null>(null);
	let draggingSectionIdx = $state<number | null>(null);
	let draggingQuestion = $state<{ sectionId: string; index: number } | null>(null);

	// insertBefore = the index in the list at which the item will land
	let sectionInsertBefore = $state<number | null>(null);
	let questionInsert = $state<{ sectionId: string; insertBefore: number } | null>(null);

	function onSectionDragStart(e: DragEvent, index: number) {
		draggingType = 'section';
		draggingSectionIdx = index;
		e.dataTransfer!.effectAllowed = 'move';
		e.stopPropagation();
	}

	function onQuestionDragStart(e: DragEvent, sectionId: string, index: number) {
		draggingType = 'question';
		draggingQuestion = { sectionId, index };
		e.dataTransfer!.effectAllowed = 'move';
		e.stopPropagation();
	}

	function onSectionRowDragOver(e: DragEvent, index: number) {
		if (draggingType !== 'section') return;
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		sectionInsertBefore = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
	}

	function onQuestionRowDragOver(e: DragEvent, sectionId: string, index: number) {
		if (draggingType !== 'question') return;
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		questionInsert = {
			sectionId,
			insertBefore: e.clientY < rect.top + rect.height / 2 ? index : index + 1
		};
	}

	function onSectionDrop(e: DragEvent) {
		e.preventDefault();
		if (draggingSectionIdx === null || sectionInsertBefore === null) {
			clearDrag();
			return;
		}
		// Adjust for the index shift caused by removing the dragged item first
		const insertIdx =
			draggingSectionIdx < sectionInsertBefore ? sectionInsertBefore - 1 : sectionInsertBefore;
		if (draggingSectionIdx !== insertIdx) {
			const sections = guideStore.localSections.slice();
			const [moved] = sections.splice(draggingSectionIdx, 1);
			sections.splice(insertIdx, 0, moved);
			guideStore.localSections = sections;
		}
		clearDrag();
	}

	function onQuestionDrop(e: DragEvent) {
		e.preventDefault();
		if (!draggingQuestion || !questionInsert) {
			clearDrag();
			return;
		}
		const { sectionId: fromSectionId, index: fromIndex } = draggingQuestion;
		const { sectionId: toSectionId, insertBefore } = questionInsert;
		const newQuestions = { ...guideStore.localQuestions };
		if (fromSectionId === toSectionId) {
			const insertIdx = fromIndex < insertBefore ? insertBefore - 1 : insertBefore;
			if (fromIndex !== insertIdx) {
				const list = newQuestions[fromSectionId].slice();
				const [moved] = list.splice(fromIndex, 1);
				list.splice(insertIdx, 0, moved);
				newQuestions[fromSectionId] = list;
			}
		} else {
			const fromList = newQuestions[fromSectionId].slice();
			const [moved] = fromList.splice(fromIndex, 1);
			const toList = (newQuestions[toSectionId] || []).slice();
			toList.splice(insertBefore, 0, moved);
			newQuestions[fromSectionId] = fromList;
			newQuestions[toSectionId] = toList;
		}
		guideStore.localQuestions = newQuestions;
		clearDrag();
	}

	function clearDrag() {
		draggingType = null;
		draggingSectionIdx = null;
		draggingQuestion = null;
		sectionInsertBefore = null;
		questionInsert = null;
	}

	// Don't show the indicator when it would be a no-op (item stays in place)
	function showSectionIndicator(i: number): boolean {
		if (draggingType !== 'section' || sectionInsertBefore !== i || draggingSectionIdx === null)
			return false;
		return draggingSectionIdx !== i && draggingSectionIdx !== i - 1;
	}

	function showQuestionIndicator(sectionId: string, i: number): boolean {
		if (draggingType !== 'question' || !questionInsert) return false;
		if (questionInsert.sectionId !== sectionId || questionInsert.insertBefore !== i) return false;
		if (draggingQuestion?.sectionId !== sectionId) return true; // cross-section always valid
		return draggingQuestion.index !== i && draggingQuestion.index !== i - 1;
	}
</script>

<aside
	class="sticky top-6 hidden max-h-[calc(100vh-4rem)] w-55 shrink-0 space-y-8 overflow-y-auto pr-4 xl:block"
>
	<nav class="space-y-1">
		<a
			href="#framing"
			class="block rounded-md px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
			'framing'
				? 'bg-primary/10 text-primary'
				: ''}">Framing</a
		>
		<a
			href="#introduction"
			class="block rounded-md px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
			'introduction'
				? 'bg-primary/10 text-primary'
				: ''}">Introduction</a
		>
		<a
			href="#sections"
			class="block rounded-md px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
			'sections'
				? 'bg-primary/10 text-primary'
				: ''}">Question sections</a
		>
		<div
			class="ml-3 space-y-1 border-l-2 border-gray-100 pl-4"
			ondragover={(e) => {
				if (draggingType === 'section') e.preventDefault();
			}}
			ondrop={onSectionDrop}
		>
			{#each localSections as section, i}
				<!-- Drop indicator line BEFORE this section -->
				{#if showSectionIndicator(i)}
					<div class="pointer-events-none mx-1 h-0.5 rounded-full bg-primary"></div>
				{/if}

				<div class="space-y-1" class:opacity-40={draggingSectionIdx === i}>
					<!-- Section header row – draggable for section reordering -->
					<div
						draggable="true"
						class="group/section flex items-center rounded-md transition-colors hover:bg-gray-100
							{activeId === section.id ? 'bg-primary/10' : ''}"
						ondragstart={(e) => onSectionDragStart(e, i)}
						ondragover={(e) => onSectionRowDragOver(e, i)}
						ondragend={clearDrag}
					>
						<div
							class="cursor-grab px-1.5 py-2 text-gray-300 opacity-0 transition-opacity group-hover/section:opacity-100"
							title="Drag to reorder"
						>
							<i class="fa-solid fa-grip-vertical text-xs"></i>
						</div>
						<a
							href="#{section.id}"
							draggable="false"
							class="min-w-0 flex-1 py-1.5 pr-2 text-sm font-medium text-gray-600 {activeId ===
							section.id
								? 'text-primary'
								: ''}"
						>
							Section {i + 1}
							{#if section.description}
								<span class="block truncate text-xs text-gray-400">{section.description}</span>
							{/if}
						</a>
					</div>

					<!-- Questions for this section (always rendered for drop targeting) -->
					<div
						class="ml-2 space-y-0.5 border-l border-gray-200 pl-3"
						ondragover={(e) => {
							if (draggingType === 'question') e.preventDefault();
						}}
						ondrop={onQuestionDrop}
					>
						{#each (localQuestions[section.id] || []) as question, qIdx}
							<!-- Drop indicator line BEFORE this question -->
							{#if showQuestionIndicator(section.id, qIdx)}
								<div class="pointer-events-none mx-1 h-0.5 rounded-full bg-primary"></div>
							{/if}

							<div
								draggable="true"
								class="group/question flex items-center rounded-md transition-colors hover:bg-gray-100
									{activeId === question.id ? 'bg-primary/10' : ''}
									{draggingQuestion?.sectionId === section.id && draggingQuestion?.index === qIdx ? 'opacity-40' : ''}"
								ondragstart={(e) => onQuestionDragStart(e, section.id, qIdx)}
								ondragover={(e) => onQuestionRowDragOver(e, section.id, qIdx)}
								ondragend={clearDrag}
							>
								<div
									class="cursor-grab px-1.5 py-1 text-gray-300 opacity-0 transition-opacity group-hover/question:opacity-100"
									title="Drag to reorder"
								>
									<i class="fa-solid fa-grip-vertical text-xs"></i>
								</div>
								<a
									href="#{question.id}"
									draggable="false"
									class="block min-w-0 flex-1 truncate py-1 pr-2 text-xs text-gray-500 transition-colors {activeId ===
									question.id
										? 'text-primary'
										: ''}"
									title={question.main_question || `Question ${qIdx + 1}`}
								>
									{question.main_question || `Question ${qIdx + 1}`}
								</a>
							</div>
						{/each}

						<!-- Drop indicator + catch zone at END of questions list -->
						{#if showQuestionIndicator(section.id, (localQuestions[section.id] || []).length)}
							<div class="pointer-events-none mx-1 h-0.5 rounded-full bg-primary"></div>
						{/if}
						<div
							class="h-2"
							ondragover={(e) => {
								if (draggingType !== 'question') return;
								e.preventDefault();
								e.stopPropagation();
								questionInsert = {
									sectionId: section.id,
									insertBefore: (localQuestions[section.id] || []).length
								};
							}}
						></div>
					</div>
				</div>
			{/each}

			<!-- Drop indicator + catch zone at END of sections list -->
			{#if showSectionIndicator(localSections.length)}
				<div class="pointer-events-none mx-1 h-0.5 rounded-full bg-primary"></div>
			{/if}
			<div
				class="h-2"
				ondragover={(e) => {
					if (draggingType !== 'section') return;
					e.preventDefault();
					e.stopPropagation();
					sectionInsertBefore = localSections.length;
				}}
			></div>
		</div>
		<a
			href="#outro"
			class="block rounded-md px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
			'outro'
				? 'bg-primary/10 text-primary'
				: ''}">Outro</a
		>
		<a
			href="#timed_messages"
			class="block rounded-md px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
			'timed_messages'
				? 'bg-primary/10 text-primary'
				: ''}">Timed Messages</a
		>
	</nav>
</aside>
