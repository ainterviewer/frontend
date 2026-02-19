<script lang="ts">
	import { CollisionPriority } from '@dnd-kit/abstract';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import SidebarSortableQuestion from './SidebarSortableQuestion.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	interface Props {
		section: GuideSection;
		sectionIndex: number;
		questions: GuideQuestion[];
		activeId: string;
	}

	let { section, sectionIndex, questions, activeId }: Props = $props();

	const { ref, handleRef, isDragging } = useSortable({
		id: section.id,
		index: () => sectionIndex,
		type: 'sidebar-section',
		// Accept questions so sections serve as cross-section drop targets (low priority fallback)
		accept: ['sidebar-section', 'sidebar-question'],
		collisionPriority: CollisionPriority.Low,
		data: { type: 'sidebar-section', sectionId: section.id }
	});
</script>

<div class:opacity-40={isDragging.current} {@attach ref}>
	<!-- Section header row -->
	<div
		class="group/section flex items-center rounded-md transition-colors hover:bg-gray-100
			{activeId === section.id ? 'bg-primary/10' : ''}"
	>
		<div
			class="cursor-grab px-1.5 py-2 text-gray-300 opacity-0 transition-opacity group-hover/section:opacity-100"
			title="Drag to reorder"
			{@attach handleRef}
		>
			<i class="fa-solid fa-grip-vertical text-xs"></i>
		</div>
		<a
			href="#{section.id}"
			draggable="false"
			class="min-w-0 flex-1 py-1.5 pr-2 text-sm font-medium text-gray-600
				{activeId === section.id ? 'text-primary' : ''}"
		>
			Section {sectionIndex + 1}
			{#if section.description}
				<span class="block truncate text-xs text-gray-400">{section.description}</span>
			{/if}
		</a>
	</div>

	<!-- Questions (always rendered so empty sections are valid drop targets) -->
	<div class="ml-2 min-h-3 space-y-0.5 border-l border-gray-200 pl-3">
		{#each questions as question, qIdx (question.id)}
			<SidebarSortableQuestion
				{question}
				questionIndex={qIdx}
				sectionId={section.id}
				{activeId}
			/>
		{/each}
	</div>
</div>
