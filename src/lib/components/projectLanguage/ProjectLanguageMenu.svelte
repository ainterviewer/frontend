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
	let pendingRemove = $state<string | null>(null);

	let currentLanguageName = $derived(
		availableLanguages.find((l) => l.code === currentLang)?.name ?? currentLang
	);

	function closeMenu() {
		open = false;
		pendingRemove = null;
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (open) {
			closeMenu();
		} else {
			open = true;
		}
	}

	function selectLanguage(code: string) {
		if (code !== currentLang) {
			onLanguageSwitch(code);
		}
		closeMenu();
	}

	function handleAdd() {
		onAddLanguage();
		closeMenu();
	}

	function handleRemove(code: string) {
		onRemoveLanguage(code);
		closeMenu();
	}

	function handleSetDefault(code: string) {
		onSetDefault(code);
		closeMenu();
	}

	function handleWindowClick() {
		if (open) {
			closeMenu();
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
			class="absolute bottom-full left-0 mb-2 min-w-[260px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
			role="menu"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					if (pendingRemove) {
						pendingRemove = null;
					} else {
						closeMenu();
					}
				}
			}}
		>
			{#each availableLanguages as lang (lang.code)}
				{#if pendingRemove === lang.code}
					<div class="flex items-center gap-2 bg-red-50 px-4 py-2 text-sm">
						<span class="text-gray-700">Remove {lang.name}?</span>
						<div class="ml-auto flex shrink-0 items-center gap-1">
							<button
								type="button"
								class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
								onclick={() => (pendingRemove = null)}
							>
								Cancel
							</button>
							<button
								type="button"
								class="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
								onclick={() => handleRemove(lang.code)}
							>
								Remove
							</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center hover:bg-gray-50">
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-2 px-4 py-2 text-left text-sm"
							onclick={() => selectLanguage(lang.code)}
						>
							<span
								class="inline-block h-3 w-3 shrink-0 rounded-full border-2 {lang.code === currentLang
									? 'border-blue-500 bg-blue-500'
									: 'border-gray-300 bg-white'}"
							></span>
							<span class="truncate">{lang.name}</span>
						</button>

						<div class="flex shrink-0 items-center gap-1 pr-2">
							{#if lang.is_default}
								<span
									class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
									title="Used when a respondent's language isn't available, and as the source for translations"
								>
									Default
								</span>
							{:else}
								<button
									type="button"
									class="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
									title="Make {lang.name} the default"
									aria-label="Make {lang.name} the default"
									onclick={() => handleSetDefault(lang.code)}
								>
									<i class="fa-regular fa-star text-xs"></i>
								</button>

								{#if availableLanguages.length > 1}
									<button
										type="button"
										class="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
										title="Remove {lang.name}"
										aria-label="Remove {lang.name}"
										onclick={() => (pendingRemove = lang.code)}
									>
										<i class="fa-solid fa-trash text-xs"></i>
									</button>
								{/if}
							{/if}
						</div>
					</div>
				{/if}
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
		</div>
	{/if}
</div>
