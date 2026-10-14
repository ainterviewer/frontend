<script lang="ts">
	// Which language's text a setup page is editing, and how much of it is not
	// translated yet. Shared by the guide, consent and welcome pages, so the
	// same notice sits in the same place on each; sticky, so it stays in view
	// while editing a long guide.
	interface Props {
		languageName: string;
		defaultLanguageName: string;
		isDefault: boolean;
		untranslated: number;
		/** The language is still being translated: not offered to respondents. */
		inProgress?: boolean;
		translating?: boolean;
		disabled?: boolean;
		onTranslate?: () => void;
	}

	let {
		languageName,
		defaultLanguageName,
		isDefault,
		untranslated,
		inProgress = false,
		translating = false,
		disabled = false,
		onTranslate
	}: Props = $props();
</script>

{#if !isDefault || untranslated > 0}
	<div
		class="sticky top-0 z-20 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-b-lg border px-4 py-2.5 text-sm shadow-sm {untranslated
			? 'border-amber-300 bg-amber-50 text-amber-900'
			: 'border-gray-200 bg-gray-50 text-gray-700'}"
	>
		<div>
			<p>
				Editing the <span class="font-semibold">{languageName}</span> text. Everything else is shared
				by every language, so changing it changes it everywhere.
			</p>
			{#if inProgress}
				<p class="mt-0.5">
					<i class="fa-solid fa-person-digging mr-1"></i>
					{languageName} is in progress: publishing leaves it out, so respondents are not offered it.
					Mark it ready in the language menu when it is done.
				</p>
			{/if}
			{#if untranslated}
				<p class="mt-0.5">
					<i class="fa-solid fa-language mr-1"></i>
					{untranslated} text{untranslated === 1 ? ' is' : 's are'} not translated yet. Highlighted fields
					show the {defaultLanguageName} text as a hint, and respondents in {languageName} see it until
					they are translated.
				</p>
			{/if}
		</div>
		{#if untranslated && !isDefault && onTranslate}
			<button
				class="shrink-0 rounded-full bg-white px-4 py-1.5 font-medium text-amber-900 shadow-sm ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50"
				onclick={onTranslate}
				disabled={translating || disabled}
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i>
				{translating ? 'Translating…' : `Translate missing from ${defaultLanguageName}`}
			</button>
		{/if}
	</div>
{/if}
