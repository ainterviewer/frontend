<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { untrack } from 'svelte';

	import type { ContentError } from '$lib/api';
	import { pick } from '$lib/guide/localized';
	import type { GuideQuestion } from '$lib/guide/types';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';
	import { plainMarkup, sanitizeMarkup } from '$lib/utils/sanitize';

	import OutlineErrorMark from './OutlineErrorMark.svelte';

	interface Props {
		question: GuideQuestion;
		questionIndex: number;
		sectionId: string;
		activeId: string;
		/** The guide's errors in this question. */
		errors: ContentError[];
	}

	let { question, questionIndex, sectionId, activeId, errors }: Props = $props();

	const { ref, handleRef, isDragging } = useSortable(
		untrack(() => ({
			id: question.id,
			index: () => questionIndex,
			group: sectionId,
			type: 'sidebar-question',
			accept: 'sidebar-question',
			data: { type: 'sidebar-question', sectionId }
		}))
	);

	const guideStore = getGuideStore();
	let mainQuestion = $derived(pick(question.main_question, guideStore.languages));
</script>

<div
	class="group/question flex items-center rounded-md transition-colors hover:bg-gray-100
		{activeId === question.id ? 'bg-primary/10' : ''}
		{isDragging.current ? 'opacity-40' : ''}"
	{@attach ref}
>
	<div
		class="cursor-grab px-1.5 py-0.5 text-gray-300 opacity-0 transition-opacity group-hover/question:opacity-100"
		title="Drag to reorder"
		{@attach handleRef}
	>
		<i class="fa-solid fa-grip-vertical text-xs"></i>
	</div>
	<a
		href="#{question.id}"
		draggable="false"
		class="block min-w-0 flex-1 truncate py-0.5 text-xs text-gray-500 transition-colors
			{errors.length ? '' : 'pr-2'}
			{activeId === question.id ? 'text-primary' : ''}"
		title={plainMarkup(mainQuestion) || `Question ${questionIndex + 1}`}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html sanitizeMarkup(mainQuestion) || `Question ${questionIndex + 1}`}
	</a>
	<OutlineErrorMark id={question.id} {errors} />
</div>
