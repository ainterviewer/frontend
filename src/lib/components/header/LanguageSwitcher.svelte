<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ProjectLanguage } from '$lib/api/types.gen';
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	let {
		projectId,
		languageCode,
		languages
	}: { projectId: string; languageCode: string; languages: ProjectLanguage[] } = $props();

	let open = $state(false);

	let current = $derived(languages.find((l) => l.code === languageCode));

	function select(language: ProjectLanguage) {
		open = false;
		// Switching drops back to the project root: the current sub-page may not
		// exist for the language being switched to.
		goto(resolve(`/dashboard/projects/${projectId}/${language.code}`));
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="flex cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1 text-xs text-light hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
		aria-label="Switch language"
	>
		<span>{current?.name ?? languageCode}</span>
		<i class="fa-solid fa-chevron-down text-[0.6rem] opacity-70"></i>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 min-w-48 overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg focus:outline-none"
			sideOffset={8}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open: contentOpen })}
				{#if contentOpen}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<div class="border-b border-gray-200 px-3 py-2 text-sm font-semibold">
								Switch language
							</div>
							<div class="py-1" role="listbox" aria-label="Languages">
								{#each languages as language (language.code)}
									<button
										type="button"
										role="option"
										aria-selected={language.code === languageCode}
										onclick={() => select(language)}
										class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
									>
										<span class="w-3.5 shrink-0 text-xs text-primary">
											{#if language.code === languageCode}
												<i class="fa-solid fa-check"></i>
											{/if}
										</span>
										<span class="truncate">{language.name}</span>
										{#if language.is_default}
											<span class="ml-auto text-[0.65rem] text-gray-400 uppercase">default</span>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
