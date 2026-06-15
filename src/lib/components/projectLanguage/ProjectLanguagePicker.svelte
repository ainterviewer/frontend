<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Projects } from '$lib/api';
	import type { LanguageDict } from '$lib/api/types.gen';
	import { toast } from 'svelte-sonner';
	import AddLanguageModal from './AddLanguageModal.svelte';
	import ProjectLanguageMenu from './ProjectLanguageMenu.svelte';

	let {
		projectId,
		currentLang,
		availableLanguages,
		canSwitch
	}: {
		projectId: string;
		currentLang: string;
		availableLanguages: LanguageDict[];
		/** Called before navigating to another language. Return false to cancel (e.g. unsaved changes). */
		canSwitch?: () => boolean | Promise<boolean>;
	} = $props();

	let showAddModal = $state(false);

	async function handleSwitch(code: string) {
		if (canSwitch) {
			const ok = await canSwitch();
			if (!ok) return;
		}
		const basePath = window.location.pathname.replace(`/${currentLang}/`, `/${code}/`);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- runtime-built path, not a static route
		goto(basePath);
	}

	async function handleAdd(code: string, translate: boolean) {
		const { error } = await Projects.addProjectLanguage({
			path: { project_id: projectId },
			body: { language: code, translate }
		});
		if (error) {
			throw new Error('Failed to add language');
		}
		await invalidateAll();
		toast.success('Language added');
	}

	async function handleRemove(code: string) {
		if (availableLanguages.length <= 1) return;
		const { error } = await Projects.removeProjectLanguage({
			path: { project_id: projectId },
			body: code
		});
		if (error) {
			console.error('Failed to remove language', error);
			toast.error('Failed to remove language');
			return;
		}
		toast.success('Language removed');
		if (code === currentLang) {
			const remaining = availableLanguages.find((l) => l.code !== code);
			if (remaining) {
				const basePath = window.location.pathname.replace(
					`/${currentLang}/`,
					`/${remaining.code}/`
				);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- runtime-built path, not a static route
				goto(basePath);
				return;
			}
		}
		await invalidateAll();
	}
</script>

<ProjectLanguageMenu
	{currentLang}
	{availableLanguages}
	onLanguageSwitch={handleSwitch}
	onAddLanguage={() => (showAddModal = true)}
	onRemoveLanguage={handleRemove}
/>

<AddLanguageModal
	bind:open={showAddModal}
	onAdd={handleAdd}
	existingLanguageCodes={availableLanguages.map((l) => l.code)}
/>
