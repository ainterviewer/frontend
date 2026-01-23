<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Auth } from '$lib/api';
	import type { ProjectPublic, UserPublic } from '$lib/api/types.gen';
	import Wave from '$lib/components/Wave.svelte';
	import { parseProjectRoute } from '$lib/utils/urls.js';

	interface HeaderProps {
		data: {
			user: UserPublic;
			project?: ProjectPublic | null;
		};
	}

	let { data }: HeaderProps = $props();
	let { projectId } = $derived(parseProjectRoute(page.url.pathname));

	let logoAnimate = $state(false);
	let menuOpen = $state(false);

	export async function signOut() {
		await Auth.logout();
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
					<b>AInterviewer</b>
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
				<li>
					<a
						href={resolve('/dashboard')}
						class="m-2 block p-2 text-center text-sm text-gray-200 no-underline hover:text-light"
						>Dashboard</a
					>
				</li>
				<!-- FIXME: -->
				<!-- <li> -->
				<!-- 	<a -->
				<!-- 		href={resolve('/docs')} -->
				<!-- 		class="m-2 block p-2 text-center text-sm text-gray-200 no-underline hover:text-light" -->
				<!-- 		>Docs</a -->
				<!-- 	> -->
				<!-- </li> -->
				<li>
					<div class="relative">
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								menuOpen = !menuOpen;
							}}
							class="font-inherit m-4 block cursor-pointer border-none bg-transparent text-center text-base font-normal text-black"
						>
							<div
								class="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-secondary hover:bg-secondary hover:brightness-85"
							>
								<span class="text-body font-medium">{data.user?.name?.[0] ?? ''}</span>
							</div>
						</button>
						<div
							class="ring-opacity-5 absolute right-0 z-50 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black transition-all duration-200 {menuOpen
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
									{data.user.name}
								</div>
								<div class="block px-4 pb-2 text-xs text-gray-500">
									{data.user.email}
								</div>
								<!-- FIXME: -->
								<!-- <a -->
								<!-- 	href={resolve('/dashboard/settings/')} -->
								<!-- 	class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary" -->
								<!-- 	role="menuitem">Your profile</a -->
								<!-- > -->
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
				</li>
			</ul>
		</nav>
	</div>
</header>
