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
	import { parseProjectRoute } from '$lib/utils/urls';

	let { items, collapsed = false }: { items: SidebarItem[]; collapsed?: boolean } = $props();

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

	function isActive(href?: string) {
		if (!href) return false;
		const resolvedHref = getResolvedHref(href);
		return page.url.pathname === resolvedHref;
	}
</script>

<div
	id="sidebar"
	class={[
		'fixed top-0 left-0 z-900 h-full overflow-y-auto bg-dark px-0 py-[100px] transition-all duration-500',
		collapsed ? 'w-[70px]' : 'w-[250px]'
	].join(' ')}
>
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

{#snippet listItem(item: SidebarItem, level = 0)}
	{@const active = isActive(item.href)}
	{@const hasChildren = !!item.children?.length}

	<li class={['w-full leading-loose', hasChildren && 'group main'].join(' ')}>
		<a
			{...item.href && { href: getResolvedHref(item.href) }}
			class={[
				'peer relative block w-full text-light no-underline transition-colors',
				'hover:bg-light hover:text-dark',
				active && 'active',
				hasChildren && "after:absolute after:right-[25px] after:content-['⌄']"
			].join(' ')}
		>
			{#if item.icon}
				<span
					class={['icon inline-block min-w-6 text-center', level === 0 ? 'ml-6' : 'ml-14'].join(
						' '
					)}
				>
					<i class={item.icon}></i>
				</span>
			{/if}
			{#if item.label}
				<span
					class={[
						'item pl-1',
						collapsed ? 'hidden' : 'inline',
						active && "after:ml-2 after:content-['<']"
					].join(' ')}>{item.label}</span
				>
			{/if}
		</a>

		{#if hasChildren}
			<ul
				class={[
					'max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-out',
					'group-hover:max-h-[500px] group-hover:opacity-100',
					'peer-[.active]:max-h-[500px] peer-[.active]:opacity-100',
					'has-[.active]:max-h-[500px] has-[.active]:opacity-100'
				].join(' ')}
			>
				{#each item.children! as child (child.label || child.href || child)}
					{#if !child.requiresAdmin || auth.isAdmin}
						{@render listItem(child, level + 1)}
					{/if}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
