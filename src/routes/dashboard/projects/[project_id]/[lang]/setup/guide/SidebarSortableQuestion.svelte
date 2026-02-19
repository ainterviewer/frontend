<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import type { GuideQuestion } from './types';

	interface Props {
		question: GuideQuestion;
		questionIndex: number;
		sectionId: string;
		activeId: string;
	}

	let { question, questionIndex, sectionId, activeId }: Props = $props();

	const { ref, handleRef, isDragging } = useSortable({
		id: question.id,
		index: () => questionIndex,
		group: sectionId,
		type: 'sidebar-question',
		accept: 'sidebar-question',
		data: { type: 'sidebar-question', sectionId }
	});
</script>

<div
	class="group/question flex items-center rounded-md transition-colors hover:bg-gray-100
		{activeId === question.id ? 'bg-primary/10' : ''}
		{isDragging.current ? 'opacity-40' : ''}"
	{@attach ref}
>
	<div
		class="cursor-grab px-1.5 py-1 text-gray-300 opacity-0 transition-opacity group-hover/question:opacity-100"
		title="Drag to reorder"
		{@attach handleRef}
	>
		<i class="fa-solid fa-grip-vertical text-xs"></i>
	</div>
	<a
		href="#{question.id}"
		draggable="false"
		class="block min-w-0 flex-1 truncate py-1 pr-2 text-xs text-gray-500 transition-colors
			{activeId === question.id ? 'text-primary' : ''}"
		title={question.main_question || `Question ${questionIndex + 1}`}
	>
		{question.main_question || `Question ${questionIndex + 1}`}
	</a>
</div>
