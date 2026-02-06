<script module lang="ts">
	import '../../app.css';
	export type SidebarItem = {
		label?: string;
		href?: string;
		icon?: string;
		children?: SidebarItem[];
		type?: 'link' | 'separator';
		requiresAdmin?: boolean;
		project_id?: string;
	};
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import { sidebar } from '$lib/sidebar.svelte';
	import { parseProjectRoute } from '$lib/utils/urls';

	//  TODO: Align text after icons
	let { items }: { items: SidebarItem[] } = $props();
	let collapsed = $derived(sidebar.collapsed);
	let expanded = $state(!sidebar.collapsed);

	$effect(() => {
		if (sidebar.collapsed) {
			expanded = false;
		} else {
			const timeout = setTimeout(() => (expanded = true), 500);
			return () => clearTimeout(timeout);
		}
	});

	// Extract projectId from the current URL
	let { projectId, languageCode } = $derived(parseProjectRoute(page.url.pathname));

	function getResolvedHref(href?: string) {
		if (!href) return undefined;

		let resolvedHref = href;

		if (projectId && resolvedHref.includes('{projectId}')) {
			resolvedHref = resolvedHref.replace('{projectId}', projectId);
		}
		if (languageCode && resolvedHref.includes('{languageCode}')) {
			resolvedHref = resolvedHref.replace('{languageCode}', languageCode);
		}

		return resolvedHref;
	}

	function getActiveHref(itemList: SidebarItem[], pathname: string) {
		let bestMatch: string | undefined;
		let maxLen = -1;
		const normalizedPath = pathname.replace(/\/$/, '') || '/';

		function traverse(list: SidebarItem[]) {
			for (const item of list) {
				if (item.href) {
					const resolved = getResolvedHref(item.href);
					if (resolved) {
						const normalizedResolved = resolved.replace(/\/$/, '') || '/';

						const isMatch =
							normalizedPath === normalizedResolved ||
							(normalizedResolved === '/' && normalizedPath !== '/') ||
							normalizedPath.startsWith(normalizedResolved + '/');

						if (isMatch) {
							if (normalizedResolved.length > maxLen) {
								maxLen = normalizedResolved.length;
								bestMatch = item.href;
							}
						}
					}
				}
				if (item.children) {
					traverse(item.children);
				}
			}
		}

		traverse(itemList);
		return bestMatch;
	}

	let activeItemHref = $derived(getActiveHref(items, page.url.pathname));

	function isActive(href?: string) {
		return !!href && href === activeItemHref;
	}
</script>

<div
	id="sidebar"
	class={[
		'fixed top-0 left-0 z-900 h-full overflow-y-auto bg-dark px-0 py-[100px] transition-all duration-500',
		collapsed ? 'w-[70px]' : 'w-[250px]'
	].join(' ')}
>
	<button
		onclick={() => sidebar.toggle()}
		class="absolute top-20 right-0 flex h-8 w-8 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-primary text-light shadow-md transition-transform hover:scale-110"
		aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		<i class={collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left'}></i>
	</button>

	<ul class="m-0 list-none p-0">
		{#each items as item (item.label || item.href || item)}
			{#if !item.requiresAdmin || auth.isAdmin}
				{#if item.type === 'separator'}
					<hr class="mx-auto my-2.5 w-[90%] border-0 border-t border-primary" />
				{:else}
					{@render listItem(item)}
				{/if}
			{/if}
		{/each}
	</ul>
</div>

{#snippet listItem(item: SidebarItem, level = 0, isLast = false)}
	{@const active = isActive(item.href)}
	{@const hasChildren = !!item.children?.length}

	<li class={['w-full leading-loose', hasChildren && 'group main'].join(' ')}>
		<a
			{...item.href && { href: getResolvedHref(item.href) }}
			class={[
				'peer relative block w-full text-light no-underline transition-colors select-none',
				'hover:bg-light hover:text-dark',
				active && 'active'
			].join(' ')}
		>
			{#if item.icon}
				<span
					class={[
						'icon inline-block min-w-6 text-center transition-all duration-500',
						level === 0
							? 'ml-6'
							: collapsed
								? 'ml-6 text-xs'
								: 'ml-9 border-l pl-5' +
									(isLast
										? ' [border-image:linear-gradient(to_bottom,#fff_60%,transparent_40%)_1_100%]'
										: '')
					].join(' ')}
				>
					<i class={item.icon}></i>
				</span>
			{/if}
			{#if item.label}
				<span
					class={[
						'item pl-1',
						expanded ? 'inline' : 'hidden',
						active && "font-bold after:ml-2 after:content-['<']"
					].join(' ')}>{item.label}</span
				>
			{/if}
		</a>

		{#if hasChildren}
			{@const visibleChildren = item.children!.filter(
				(child) => !child.requiresAdmin || auth.isAdmin
			)}
			<ul class="m-0 list-none p-0">
				{#each visibleChildren as child, i (child.label || child.href || child)}
					{@render listItem(child, level + 1, i === visibleChildren.length - 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
