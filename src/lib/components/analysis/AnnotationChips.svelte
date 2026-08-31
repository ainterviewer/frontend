<script lang="ts">
	import type { AnalysisCategoryPublic, MessageAnnotationPublic } from '$lib/api/types.gen';
	import { authorName, summarizeAnnotation } from '$lib/utils/annotations';
	import { getContrastColor } from '$lib/utils/colors';

	interface Props {
		annotation: MessageAnnotationPublic;
		categories: AnalysisCategoryPublic[];
		/**
		 * Name the author before the chips. Annotations are per author, so a
		 * message can carry several codings; only the current user's is editable.
		 */
		showAuthor?: boolean;
	}

	let { annotation, categories, showAuthor = false }: Props = $props();

	let summary = $derived(summarizeAnnotation(annotation, categories));
	let isEmpty = $derived(summary.tags.length === 0 && summary.scores.length === 0);
</script>

{#if !isEmpty}
	{#if showAuthor}
		<span class="text-[10px] text-gray-400" title="Annotated by {authorName(annotation.author)}">
			{authorName(annotation.author)}:
		</span>
	{/if}
	{#each summary.tags as tag (tag.name)}
		<span
			class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
			class:opacity-70={showAuthor}
			style="background-color: {tag.color}; color: {getContrastColor(tag.color)}"
		>
			{tag.name}
		</span>
	{/each}
	{#each summary.scores as score (score.name)}
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
			class:opacity-70={showAuthor}
			style="background-color: {score.color}; color: {getContrastColor(score.color)}"
		>
			{score.name}: {score.value}
		</span>
	{/each}
{/if}
