<script lang="ts">
	import type { ProjectLanguage } from '$lib/api/types.gen';

	let {
		currentLang,
		availableLanguages,
		onLanguageSwitch,
		onAddLanguage,
		onRemoveLanguage,
		onSetDefault
	}: {
		currentLang: string;
		availableLanguages: ProjectLanguage[];
		onLanguageSwitch: (code: string) => void;
		onAddLanguage: () => void;
		onRemoveLanguage: (code: string) => void;
		onSetDefault: (code: string) => void;
	} = $props();

	let open = $state(false);

	let currentLanguageName = $derived(
		availableLanguages.find((l) => l.code === currentLang)?.name ?? currentLang
	);

	let currentIsDefault = $derived(
		availableLanguages.find((l) => l.code === currentLang)?.is_default ?? false
	);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function selectLanguage(code: string) {
		if (code !== currentLang) {
			onLanguageSwitch(code);
		}
		open = false;
	}

	function handleAdd() {
		onAddLanguage();
		open = false;
	}

	function handleRemove() {
		const confirmed = confirm(
			`Are you sure you want to remove "${currentLanguageName}" from this project?`
		);
		if (confirmed) {
			onRemoveLanguage(currentLang);
		}
		open = false;
	}

	function handleSetDefault() {
		onSetDefault(currentLang);
		open = false;
	}

	function handleWindowClick() {
		if (open) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="relative">
	<button
		type="button"
		class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
		onclick={toggle}
	>
		<i class="fa-solid fa-globe mr-2"></i>
		{currentLanguageName}
		<i class="fa-solid fa-chevron-down ml-2 text-xs"></i>
	</button>

	{#if open}
		<div
			class="absolute bottom-full left-0 mb-2 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
			role="menu"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					open = false;
				}
			}}
		>
			{#each availableLanguages as lang (lang.code)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
					onclick={() => selectLanguage(lang.code)}
				>
					<span
						class="inline-block h-3 w-3 rounded-full border-2 {lang.code === currentLang
							? 'border-blue-500 bg-blue-500'
							: 'border-gray-300 bg-white'}"
					></span>
					{lang.name}
					{#if lang.is_default}
						<span
							class="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
							title="Used when a respondent's language isn't available, and as the source for translations"
						>
							Default
						</span>
					{/if}
				</button>
			{/each}

			<hr class="my-1 border-gray-200" />

			<button
				type="button"
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-blue-600 hover:bg-gray-50"
				onclick={handleAdd}
			>
				<i class="fa-solid fa-plus text-xs"></i>
				Add language...
			</button>

			{#if availableLanguages.length > 1 && !currentIsDefault}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
					onclick={handleSetDefault}
				>
					<i class="fa-solid fa-star text-xs"></i>
					Make {currentLanguageName} the default
				</button>
			{/if}

			{#if availableLanguages.length > 1}
				<hr class="my-1 border-gray-200" />

				{#if currentIsDefault}
					<p class="px-4 py-2 text-sm text-gray-500">
						{currentLanguageName} is the default language. Make another language the default to remove
						it.
					</p>
				{:else}
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
						onclick={handleRemove}
					>
						<i class="fa-solid fa-trash text-xs"></i>
						Remove {currentLanguageName}
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
