<script lang="ts">
	import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit-svelte/svelte';
	import { guideStore } from '$lib/stores/guideStore.svelte';
	import SidebarSortableSection from './SidebarSortableSection.svelte';
	import type { GuideQuestion, GuideSection } from './types';

	let { activeId, localSections, localQuestions } = $props<{
		activeId: string;
		localSections: GuideSection[];
		localQuestions: Record<string, GuideQuestion[]>;
	}>();

	const sensors = [PointerSensor, KeyboardSensor];

	function arrayMove<T>(arr: T[], from: number, to: number): T[] {
		const result = arr.slice();
		result.splice(to, 0, result.splice(from, 1)[0]);
		return result;
	}

	function handleDragOver(event: any) {
		const { source, target } = event.operation;
		if (!target) return;

		// Section reordering
		if (source.type === 'sidebar-section') {
			if (target.type !== 'sidebar-section' || source.id === target.id) return;
			const oldIdx = guideStore.localSections.findIndex((s) => s.id === source.id);
			const newIdx = guideStore.localSections.findIndex((s) => s.id === target.id);
			if (oldIdx !== -1 && newIdx !== -1) {
				guideStore.localSections = arrayMove(guideStore.localSections, oldIdx, newIdx);
			}
			return;
		}

		// Question reordering (same or cross-section)
		if (source.type === 'sidebar-question') {
			const fromSectionId: string = source.data?.sectionId;
			// Target is either a question (use its sectionId) or a section (use its id directly)
			const toSectionId: string =
				target.type === 'sidebar-question' ? target.data?.sectionId : target.data?.sectionId ?? target.id;

			if (!fromSectionId || !toSectionId) return;

			const fromQuestions = guideStore.localQuestions[fromSectionId];
			if (!fromQuestions) return;

			const fromIdx = fromQuestions.findIndex((q) => q.id === source.id);
			if (fromIdx === -1) return;

			if (fromSectionId === toSectionId) {
				// Same section: reorder in place
				const toIdx = fromQuestions.findIndex((q) => q.id === target.id);
				if (toIdx === -1 || fromIdx === toIdx) return;
				guideStore.localQuestions = {
					...guideStore.localQuestions,
					[fromSectionId]: arrayMove(fromQuestions, fromIdx, toIdx)
				};
			} else {
				// Cross-section: remove from source, insert before target in destination
				const toQuestions = guideStore.localQuestions[toSectionId] || [];
				const newFrom = fromQuestions.slice();
				const [moved] = newFrom.splice(fromIdx, 1);
				const newTo = toQuestions.slice();
				const toIdx = newTo.findIndex((q) => q.id === target.id);
				if (toIdx !== -1) {
					newTo.splice(toIdx, 0, moved);
				} else {
					newTo.push(moved);
				}
				guideStore.localQuestions = {
					...guideStore.localQuestions,
					[fromSectionId]: newFrom,
					[toSectionId]: newTo
				};
			}
		}
	}
</script>

<!-- Sidebar has its own DragDropProvider, independent of the main guide's context -->
<DragDropProvider {sensors} onDragOver={handleDragOver}>
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

			<div class="ml-3 space-y-1 border-l-2 border-gray-100 pl-4">
				{#each localSections as section, i (section.id)}
					<SidebarSortableSection
						{section}
						sectionIndex={i}
						questions={localQuestions[section.id] || []}
						{activeId}
					/>
				{/each}
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
</DragDropProvider>
