<script lang="ts">
	import type { GuideQuestion, GuideSection } from './types';

	let { activeId, localSections, localQuestions } = $props<{
		activeId: string;
		localSections: GuideSection[];
		localQuestions: Record<string, GuideQuestion[]>;
	}>();
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
		<div class="ml-3 space-y-1 border-l-2 border-gray-100 pl-4">
			{#each localSections as section, i}
				<div class="space-y-1">
					<a
						href="#{section.id}"
						class="block rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 {activeId ===
						section.id
							? 'bg-primary/10 text-primary'
							: ''}"
					>
						Section {i + 1}
						{#if section.description}
							<span class="block truncate text-xs text-gray-400">{section.description}</span>
						{/if}
					</a>
					{#if localQuestions[section.id]}
						<div class="ml-2 space-y-0.5 border-l border-gray-200 pl-3">
							{#each localQuestions[section.id] as question, qIdx}
								<a
									href="#{question.id}"
									class="block max-w-[180px] truncate rounded-md px-3 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 {activeId ===
									question.id
										? 'bg-primary/10 text-primary'
										: ''}"
									title={question.main_question || `Question ${qIdx + 1}`}
								>
									{question.main_question || `Question ${qIdx + 1}`}
								</a>
							{/each}
						</div>
					{/if}
				</div>
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
