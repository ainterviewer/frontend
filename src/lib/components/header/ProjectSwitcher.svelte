<script module lang="ts">
	import { Folders } from '$lib/api';
	import type { ProjectFolderWithProjects } from '$lib/api/types.gen';

	// The folder tree is fetched the first time a switcher is opened and kept for
	// the rest of the session: it is the same list on every dashboard page, and
	// loading it in +layout.server.ts would cost a request on every navigation.
	let foldersPromise: Promise<ProjectFolderWithProjects[]> | null = null;

	function loadFolders() {
		foldersPromise ??= Folders.getFolders().then(({ data, error }) => {
			if (error) {
				// Let the next open retry rather than caching the failure.
				foldersPromise = null;
				throw error;
			}
			return data ?? [];
		});
		return foldersPromise;
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ProjectPublic } from '$lib/api/types.gen';
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	let { projectId, title }: { projectId: string; title: string } = $props();

	let open = $state(false);
	let query = $state('');
	let highlighted = $state(0);
	let folders = $state<ProjectFolderWithProjects[] | null>(null);
	let failed = $state(false);
	// Row elements by project id, so scrolling the highlighted row into view does
	// not depend on list indices that shift as the search filters.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- written from an attachment, read from a key handler; nothing renders from it
	const rows = new Map<string, HTMLElement>();
	// Only reveal the current project's folder on the first render of an open
	// popover — re-running it while the user types would fight their search.
	let revealed = false;

	let groups = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return (folders ?? [])
			.map((folder) => ({
				folder,
				projects: needle
					? folder.projects.filter((p) => p.title.toLowerCase().includes(needle))
					: folder.projects
			}))
			.filter((group) => group.projects.length > 0);
	});

	// Display order, so arrow keys can walk the list across folder headings.
	let flat = $derived(groups.flatMap((group) => group.projects));

	function onOpenChange(next: boolean) {
		if (!next) return;
		query = '';
		highlighted = 0;
		failed = false;
		revealed = false;
		loadFolders().then(
			(data) => (folders = data),
			() => (failed = true)
		);
	}

	function projectHref(project: ProjectPublic) {
		const languages = project.available_languages ?? [];
		const lang = (languages.find((l) => l.is_default) ?? languages[0])?.code;
		// Without a localization we hand the project id to the server, which
		// redirects to whatever language it considers the default.
		return lang
			? resolve(`/dashboard/projects/${project.id}/${lang}`)
			: resolve(`/dashboard/projects/${project.id}`);
	}

	function select(project: ProjectPublic) {
		open = false;
		goto(projectHref(project));
	}

	// Attached to every folder heading; the one holding the current project pulls
	// itself to the top of the list so the open dropdown starts where you are.
	function revealActiveFolder(node: HTMLElement, projects: ProjectPublic[]) {
		if (revealed || !projects.some((p) => p.id === projectId)) return;
		revealed = true;
		highlighted = flat.findIndex((p) => p.id === projectId);
		// The heading's parent is the scrolling list, and both share an offset
		// parent, so their offsetTops are directly comparable.
		const list = node.parentElement;
		if (list) list.scrollTop = node.offsetTop - list.offsetTop;
	}

	function move(delta: number) {
		if (flat.length === 0) return;
		highlighted = Math.min(Math.max(highlighted + delta, 0), flat.length - 1);
		rows.get(flat[highlighted].id)?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const project = flat[highlighted];
			if (project) select(project);
		}
	}
</script>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger
		class="flex cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1 text-xs text-light hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
		aria-label="Switch project"
	>
		<span class="max-w-60 truncate">{title}</span>
		<i class="fa-solid fa-chevron-down text-[0.6rem] opacity-70"></i>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-80 overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg focus:outline-none"
			sideOffset={8}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open: contentOpen })}
				{#if contentOpen}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }} {onkeydown}>
							<div class="border-b border-gray-200 px-3 py-2 text-sm font-semibold">
								Switch project
							</div>
							<div class="border-b border-gray-200 p-2">
								<div class="relative">
									<i
										class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-gray-400"
									></i>
									<!-- svelte-ignore a11y_autofocus -->
									<input
										autofocus
										type="text"
										bind:value={query}
										oninput={() => (highlighted = 0)}
										placeholder="Search projects"
										aria-label="Search projects"
										class="w-full rounded-md border border-gray-300 py-1.5 pr-2 pl-7 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
									/>
								</div>
							</div>
							<div class="max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Projects">
								{#if failed}
									<p class="px-3 py-4 text-center text-sm text-gray-500">
										Could not load projects.
									</p>
								{:else if !folders}
									<p class="px-3 py-4 text-center text-sm text-gray-500">Loading…</p>
								{:else if flat.length === 0}
									<p class="px-3 py-4 text-center text-sm text-gray-500">No projects found.</p>
								{:else}
									{#each groups as group (group.folder.id)}
										<div
											class="px-3 pt-2 pb-1 text-[0.65rem] font-semibold tracking-wide text-gray-400 uppercase"
											{@attach (node) => revealActiveFolder(node, group.projects)}
										>
											{group.folder.title}
										</div>
										{#each group.projects as project (project.id)}
											{@const index = flat.indexOf(project)}
											<button
												{@attach (node) => {
													rows.set(project.id, node);
													return () => rows.delete(project.id);
												}}
												type="button"
												role="option"
												aria-selected={project.id === projectId}
												onclick={() => select(project)}
												onmouseenter={() => (highlighted = index)}
												class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent py-1.5 pr-3 pl-3 text-left text-sm text-gray-700 {highlighted ===
												index
													? 'bg-gray-100'
													: ''}"
											>
												<span class="w-3.5 shrink-0 text-xs text-primary">
													{#if project.id === projectId}
														<i class="fa-solid fa-check"></i>
													{/if}
												</span>
												<span class="truncate">{project.title}</span>
											</button>
										{/each}
									{/each}
								{/if}
							</div>
							<div class="border-t border-gray-200">
								<a
									href={resolve('/dashboard')}
									onclick={() => (open = false)}
									class="block px-3 py-2 text-sm text-gray-700 no-underline hover:bg-gray-100 hover:text-primary"
								>
									View all projects
								</a>
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
