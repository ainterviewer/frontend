<script lang="ts">
	import type { LocalizedText } from '$lib/api/types.gen';
	import { isUntranslated, pick } from '$lib/guide/localized';
	import { getGuideStore } from '$lib/stores/guideStore.svelte';

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
		/** Why the guide is invalid because of this field, if it is. */
		error?: string;
	}

	let {
		text,
		multiline = false,
		class: className = '',
		placeholder = '',
		id,
		error
	}: Props = $props();

	const guideStore = getGuideStore();

	let untranslated = $derived(isUntranslated(text, guideStore.lang));
	let hint = $derived(untranslated ? pick(text, guideStore.languages) : placeholder);
	let title = $derived(
		error ??
			(untranslated ? 'Not translated yet; the default language is shown as a hint' : undefined)
	);
</script>

{#if multiline}
	<textarea
		{id}
		autocomplete="off"
		class={[className, error ? 'invalid' : untranslated && 'untranslated']}
		placeholder={hint}
		{title}
		aria-invalid={error ? true : undefined}
		lang={guideStore.lang}
		spellcheck="true"
		bind:value={text[guideStore.lang]}></textarea>
{:else}
	<input
		{id}
		autocomplete="off"
		class={[className, error ? 'invalid' : untranslated && 'untranslated']}
		placeholder={hint}
		{title}
		aria-invalid={error ? true : undefined}
		lang={guideStore.lang}
		spellcheck="true"
		bind:value={text[guideStore.lang]}
	/>
{/if}

<style>
	.untranslated {
		border-color: var(--color-amber-400);
		background-color: var(--color-amber-50);
	}

	.invalid {
		border-color: var(--color-red-400);
		background-color: var(--color-red-50);
	}
</style>
