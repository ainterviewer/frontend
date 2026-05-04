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
		demoFeature?: boolean;
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
	let expanded = $derived(!collapsed);

	let user = $derived(page.data.user);
	let hasDemoFeatures = $derived(!!user?.with_demo_features);

	function canShow(item: SidebarItem) {
		if (item.requiresAdmin && !isAdmin) return false;
		if (item.demoFeature && !hasDemoFeatures) return false;
		return true;
	}

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

	let platformVersion = $derived(page.data.platformVersion);
</script>

<div
	id="sidebar"
	class={[
		'fixed top-0 left-0 z-900 h-full overflow-visible bg-dark px-0 py-25 transition-all duration-500',
		collapsed ? 'w-[70px]' : 'w-[250px]'
	].join(' ')}
>
	<button
		onclick={() => sidebar.toggle()}
		class="absolute top-[50%] right-0 z-99 flex h-8 w-8 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white text-primary transition-transform hover:scale-110"
		aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		<i class={collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left'}></i>
	</button>

	<div class="h-full overflow-x-hidden overflow-y-auto pb-12">
		<ul class="m-0 list-none p-0">
			{#each items as item (item.label || item.href || item)}
				{#if canShow(item)}
					{#if item.type === 'separator'}
						<hr class="mx-auto my-2.5 w-[90%] border-0 border-t border-primary" />
					{:else}
						{@render listItem(item)}
					{/if}
				{/if}
			{/each}
		</ul>
	</div>

	{#if platformVersion}
		<div
			class="group absolute bottom-0 left-0 w-full overflow-visible px-4 py-2 text-center text-xs text-light/60"
		>
			<span class="cursor-default whitespace-nowrap">
				{collapsed
					? platformVersion.platform_version?.slice(2)
					: `v${platformVersion.platform_version}`}
			</span>
			<div
				class={[
					'pointer-events-none invisible absolute bottom-full z-1000 mb-2 rounded bg-light px-3 py-2 text-left text-xs whitespace-nowrap text-dark opacity-0 shadow-lg transition-opacity duration-200 group-hover:visible group-hover:opacity-100',
					collapsed ? 'left-2' : 'left-1/2 -translate-x-1/2'
				].join(' ')}
			>
				<div><strong>Platform:</strong> {platformVersion.platform_version}</div>
				<div>
					<strong>Core lib:</strong>
					{platformVersion.core_lib} ({platformVersion.git?.core_lib})
				</div>
				<div>
					<strong>Backend:</strong>
					{platformVersion.backend} ({platformVersion.git?.backend})
				</div>
				<div>
					<strong>Frontend:</strong>
					{platformVersion.frontend} ({platformVersion.git?.frontend})
				</div>
				{#if platformVersion.build_time}
					<div><strong>Built:</strong> {platformVersion.build_time}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#snippet listItem(item: SidebarItem, level = 0, isLast = false)}
	{@const active = isActive(item.href)}
	{@const hasChildren = !!item.children?.length}

	<li class={['w-full leading-loose', hasChildren && 'group main'].join(' ')}>
		<a
			{...item.href && { href: getResolvedHref(item.href) }}
			class={[
				'peer relative block w-full whitespace-nowrap text-light no-underline select-none',
				item.href && 'hover:bg-light hover:text-dark',
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
								? 'ml-6 border-l pl-2' +
									(isLast
										? ' [border-image:linear-gradient(to_bottom,#fff_60%,transparent_40%)_1_100%]'
										: '')
								: 'ml-9 border-l pl-5' +
									(isLast
										? ' [border-image:linear-gradient(to_bottom,#fff_60%,transparent_40%)_1_100%]'
										: '')
					].join(' ')}
				>
					<i class={[item.icon, collapsed && level > 0 && 'text-xs'].filter(Boolean).join(' ')}></i>
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
			{@const visibleChildren = item.children!.filter(canShow)}
			<ul class="m-0 list-none p-0">
				{#each visibleChildren as child, i (child.label || child.href || child)}
					{@render listItem(child, level + 1, i === visibleChildren.length - 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
