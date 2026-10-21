<script lang="ts">
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Projects } from '$lib/api';
	import type { ProjectLanguage } from '$lib/api/types.gen';

	let {
		projectId,
		languageCode,
		languages,
		subRoute = ''
	}: {
		projectId: string;
		languageCode: string;
		languages: ProjectLanguage[];
		subRoute?: string;
	} = $props();

	let open = $state(false);

	/**
	 * The project's languages as of the last open.
	 *
	 * `languages` comes from the layout load, which re-runs on navigation and on
	 * this tab's own edits, but not when a language is added or removed in
	 * another tab or by a collaborator. So opening the menu asks again, showing
	 * the layout's list until the answer is in. The answer is kept only while
	 * the layout's list is the one it replaced: a newer load -- a navigation,
	 * another project -- is at least as fresh, and wins.
	 */
	let fresh = $state.raw<{ basis: ProjectLanguage[]; languages: ProjectLanguage[] } | null>(null);
	let list = $derived(fresh?.basis === languages ? fresh.languages : languages);
	let requests = 0;

	let current = $derived(list.find((l) => l.code === languageCode));

	function onOpenChange(next: boolean) {
		if (!next) return;
		const request = ++requests;
		const basis = languages;
		Projects.getProject({ path: { project_id: projectId } }).then(({ data }) => {
			// Only the latest open's answer, and a failure keeps what is shown.
			if (request === requests && data?.available_languages)
				fresh = { basis, languages: data.available_languages };
		});
	}

	function select(language: ProjectLanguage) {
		open = false;
		// Stay on the page you are on. `subRoute` has already been trimmed of any
		// dynamic segment, so what is left exists for every language.
		//
		// Resolved whole, in both branches, rather than appended to a resolved
		// base: appending widens the result back to a plain string, losing the
		// `ResolvedPathname` that says this path has been through `resolve`.
		goto(
			subRoute
				? resolve(`/dashboard/projects/${projectId}/${language.code}/${subRoute}`)
				: resolve(`/dashboard/projects/${projectId}/${language.code}`)
		);
	}
</script>

<Popover.Root bind:open {onOpenChange}>
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
								{#each list as language (language.code)}
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
