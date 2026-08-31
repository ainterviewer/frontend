<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';
	import type { PlatformRelease, ProjectPublic, UserPublic } from '$lib/api/types.gen';
	import Wave from '$lib/components/Wave.svelte';
	import { parseProjectRoute } from '$lib/utils/urls.js';
	import { newsworthyVersion, whatsNew } from '$lib/whatsNew.svelte';
	import LanguageSwitcher from './header/LanguageSwitcher.svelte';
	import ProjectSwitcher from './header/ProjectSwitcher.svelte';
	import HoverInfo from './HoverInfo.svelte';

	interface HeaderProps {
		data: {
			user: UserPublic;
			project?: ProjectPublic | null;
			releases?: PlatformRelease[];
		};
	}

	let { data }: HeaderProps = $props();
	let { projectId, languageCode } = $derived(parseProjectRoute(page.url.pathname));

	let languages = $derived(data.project?.available_languages ?? []);

	let logoAnimate = $state(false);
	let menuOpen = $state(false);

	// The avatar button, so closing with Escape hands focus back to what opened
	// the menu instead of dropping it on the document.
	let menuButton = $state<HTMLButtonElement | null>(null);

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !menuOpen) return;
		// Claim the Escape so page-level handlers do not also act on it.
		e.preventDefault();
		menuOpen = false;
		menuButton?.focus();
	}

	let latestRelease = $derived(newsworthyVersion(data.releases));
	let hasUnseenRelease = $derived(whatsNew.isUnseen(latestRelease));

	export async function signOut() {
		const { error } = await Auth.logout();
		if (error) {
			console.error('Logout failed', error);
		}
		goto(resolve('/login'));
	}
</script>

<svelte:window onclick={() => (menuOpen = false)} onkeydown={onWindowKeydown} />

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
			<!-- gap-1 plus the switchers' own px-2 leaves an even 12px between every
			     crumb and its separator; ml-3 gives the first slash the same gap from
			     the logo, which has no padding of its own. -->
			<div id="project-id-picker" class="flex items-center gap-1">
				{#if projectId}
					<span class="ml-3 text-light/50" aria-hidden="true">/</span>
					<ProjectSwitcher {projectId} title={data.project?.title ?? projectId} />
					{#if languageCode && languages.length > 0}
						<span class="text-light/50" aria-hidden="true">/</span>
						<LanguageSwitcher {projectId} {languageCode} {languages} />
					{/if}
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
								bind:this={menuButton}
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
										class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-light bg-orange-500"
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
											<span class="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true"></span>
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
