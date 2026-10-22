<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto, invalidateAll } from '$app/navigation';
	import { Projects } from '$lib/api';
	import type { ProjectLanguage } from '$lib/api/types.gen';
	import { toastApiError } from '$lib/utils/toast';

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
		availableLanguages: ProjectLanguage[];
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
		// The modal reports it, and stays open.
		if (error) throw error;
		await invalidateAll();
		toast.success('Language added, in progress until you mark it ready');
	}

	async function handleRemove(code: string) {
		if (availableLanguages.length <= 1) return;
		const { error } = await Projects.removeProjectLanguage({
			path: { project_id: projectId },
			body: code
		});
		if (error) {
			toastApiError(error, 'Failed to remove language');
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

	async function handleSetDefault(code: string) {
		const { error } = await Projects.setDefaultLanguage({
			path: { project_id: projectId },
			body: code
		});
		if (error) {
			toastApiError(error, 'Failed to set the default language');
			return;
		}
		await invalidateAll();
		toast.success('Default language updated');
	}

	async function handleSetInProgress(code: string, inProgress: boolean) {
		const { error } = await Projects.setLanguageInProgress({
			path: { project_id: projectId, language: code },
			body: { in_progress: inProgress }
		});
		if (error) {
			toastApiError(error, 'Failed to change the language progress');
			return;
		}
		await invalidateAll();
		toast.success(
			inProgress
				? 'Marked in progress: left out of publishing'
				: 'Marked ready: included in the next publish'
		);
	}
</script>

<ProjectLanguageMenu
	{currentLang}
	{availableLanguages}
	onLanguageSwitch={handleSwitch}
	onAddLanguage={() => (showAddModal = true)}
	onRemoveLanguage={handleRemove}
	onSetDefault={handleSetDefault}
	onSetInProgress={handleSetInProgress}
/>

<AddLanguageModal
	bind:open={showAddModal}
	onAdd={handleAdd}
	existingLanguageCodes={availableLanguages.map((l) => l.code)}
/>
