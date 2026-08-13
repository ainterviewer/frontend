<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';
	import type { PlatformRelease, ProjectPublic, UserPublic } from '$lib/api/types.gen';
	import Wave from '$lib/components/Wave.svelte';
	import { parseProjectRoute } from '$lib/utils/urls.js';
	import { whatsNew } from '$lib/whatsNew.svelte';
	import HoverInfo from './HoverInfo.svelte';

	interface HeaderProps {
		data: {
			user: UserPublic;
			project?: ProjectPublic | null;
			releases?: PlatformRelease[];
		};
	}

	let { data }: HeaderProps = $props();
	let { projectId } = $derived(parseProjectRoute(page.url.pathname));

	let logoAnimate = $state(false);
	let menuOpen = $state(false);

	let latestRelease = $derived(data.releases?.[0]?.platform_version);
	let hasUnseenRelease = $derived(whatsNew.isUnseen(latestRelease));

	export async function signOut() {
		const { error } = await Auth.logout();
		if (error) {
			console.error('Logout failed', error);
		}
		goto(resolve('/login'));
	}
</script>

<svelte:window onclick={() => (menuOpen = false)} />

<header
	class="fixed top-0 z-1000 h-11 w-full bg-primary text-light shadow-[0_0_10px_10px_rgba(0,0,0,0.15)]"
>
	<div class="flex h-full items-center justify-between px-8 text-light">
		<div class="flex items-center">
			<div class="group">
				<a
					href={resolve('/dashboard')}
					class="flex items-center gap-3 text-xl text-light no-underline visited:text-gray-200 hover:text-light"
				>
					<Wave className="h-5 w-5 transition-transform group-hover:scale-120" animate={logoAnimate}
					></Wave>
					<span class="font-[noto_sans] font-semibold">AInterviewer</span>
				</a>
			</div>
			<div id="project-id-picker">
				{#if projectId}
					<span class="mx-2.5"> / </span>
					<span class="text-xs">{data.project?.title ?? projectId}</span>
				{/if}
			</div>
		</div>
		<nav>
			<ul class="m-0 flex items-center">
				<!-- <li> -->
				<!-- 	<a -->
				<!-- 		href={resolve('/dashboard')} -->
				<!-- 		class="m-2 block p-2 text-center text-sm text-gray-200 no-underline hover:text-light" -->
				<!-- 		>Dashboard</a -->
				<!-- 	> -->
				<!-- </li> -->
				<!-- FIXME: -->
				<!-- <li> -->
				<!-- 	<a -->
				<!-- 		href={resolve('/docs')} -->
				<!-- 		class="m-2 block p-2 text-center text-sm text-gray-200 no-underline hover:text-light" -->
				<!-- 		>Docs</a -->
				<!-- 	> -->
				<!-- </li> -->
				{#if data.user?.scope === 'demo'}
					<li class="m-2 block p-2 text-center text-sm text-gray-200 no-underline hover:text-light">
						<HoverInfo
							text="You're currently active as a demo user, which means that you have restricted access to parts of the platform.
            <br><br>
            Please get <a class='text-primary underline' href='mailto:contact@ainterviewer.dk'>in contact</a> with us if you need an upgrade, allowing you to use all features of the platform."
							>Demo Access</HoverInfo
						>
					</li>
				{/if}
				<li>
					<!-- placeholder reserves the avatar's footprint in the nav flow -->
					<div class="relative m-4 h-7 w-7">
						<!-- absolute wrapper bounds BOTH the button and the dropdown so driver.js can highlight them together -->
						<div
							data-tour="header-menu-container"
							class="pointer-events-none absolute top-0 right-0 z-50 flex flex-col items-end"
						>
							<button
								data-tour="header-menu"
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									menuOpen = !menuOpen;
								}}
								class="font-inherit pointer-events-auto relative block cursor-pointer border-none bg-transparent text-center text-base font-normal text-black"
								aria-label={hasUnseenRelease
									? 'Account menu — new release available'
									: 'Account menu'}
							>
								<div
									class="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-secondary hover:bg-secondary hover:brightness-85"
								>
									<span class="text-body font-medium">{data.user?.first_name?.[0] ?? ''}</span>
								</div>
								{#if hasUnseenRelease}
									<!-- Sits on the avatar, not the menu item: the menu item is only
									     visible once the menu has already been opened. -->
									<span
										class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-light bg-primary"
										aria-hidden="true"
									></span>
								{/if}
							</button>
							<div
								data-tour="header-menu-dropdown"
								class="ring-opacity-5 pointer-events-auto mt-3 min-w-48 rounded-md bg-white shadow-lg ring-1 ring-black transition-all duration-200 {menuOpen
									? 'visible opacity-100'
									: 'invisible opacity-0'}"
							>
								<div
									class="py-1"
									role="menu"
									aria-orientation="vertical"
									aria-labelledby="options-menu"
								>
									<div class="block px-4 py-2 text-sm font-semibold text-gray-700">
										{data.user.first_name}
									</div>
									<div class="block px-4 pb-2 text-xs text-gray-500">
										{data.user.email}
									</div>
									<a
										href={resolve('/dashboard/settings/profile')}
										class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary"
										role="menuitem">Your profile</a
									>
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											menuOpen = false;
											whatsNew.open(latestRelease);
										}}
										class="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-primary"
										role="menuitem"
									>
										What's new
										{#if hasUnseenRelease}
											<span class="h-2 w-2 rounded-full bg-primary" aria-hidden="true"></span>
										{/if}
									</button>
									<button
										type="button"
										onclick={signOut}
										class="block w-full cursor-pointer px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-primary"
										role="menuitem"
									>
										Logout
									</button>
								</div>
							</div>
						</div>
					</div>
				</li>
			</ul>
		</nav>
	</div>
</header>
