<script lang="ts">
	import type { LocalizedText } from '$lib/api/types.gen';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

	import { isUntranslated, pick } from './localized';

	// One piece of text in the language being edited. `text` is the shared
	// `{language: text}` map and is edited in place; only `text[lang]` changes.
	// Untranslated text shows the default language's as a greyed placeholder,
	// and the field is marked, so a translator can see what is left.
	interface Props {
		text: LocalizedText;
		multiline?: boolean;
		class?: string;
		placeholder?: string;
		id?: string;
	}

	let { text, multiline = false, class: className = '', placeholder = '', id }: Props = $props();

	const guideStore = getGuideStore();

	let untranslated = $derived(isUntranslated(text, guideStore.lang));
	let hint = $derived(untranslated ? pick(text, guideStore.languages) : placeholder);
</script>

{#if multiline}
	<textarea
		{id}
		autocomplete="off"
		class={[className, untranslated && 'untranslated']}
		placeholder={hint}
		title={untranslated ? 'Not translated yet; the default language is shown as a hint' : undefined}
		bind:value={text[guideStore.lang]}></textarea>
{:else}
	<input
		{id}
		autocomplete="off"
		class={[className, untranslated && 'untranslated']}
		placeholder={hint}
		title={untranslated ? 'Not translated yet; the default language is shown as a hint' : undefined}
		bind:value={text[guideStore.lang]}
	/>
{/if}

<style>
	.untranslated {
		border-color: var(--color-amber-400);
		background-color: var(--color-amber-50);
	}
</style>
