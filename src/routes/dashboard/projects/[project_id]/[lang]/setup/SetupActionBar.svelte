<script lang="ts">
	import { resolve } from '$app/paths';
	import type { LanguageDict } from '$lib/api/types.gen';
	import ProjectLanguagePicker from '$lib/components/projectLanguage/ProjectLanguagePicker.svelte';

	let {
		projectId,
		lang,
		availableLanguages = [],
		saving = false,
		exporting = false,
		saveLabel = 'Save Changes',
		onSave,
		onExportPdf,
		onExportJson
	}: {
		projectId: string;
		lang: string;
		availableLanguages?: LanguageDict[];
		saving?: boolean;
		exporting?: boolean;
		saveLabel?: string;
		onSave: () => Promise<void> | void;
		onExportPdf?: () => Promise<void> | void;
		onExportJson?: () => void;
	} = $props();

	let showExportMenu = $state(false);

	const canExport = $derived(!!onExportPdf || !!onExportJson);

	function closeMenusOnWindowClick(e: MouseEvent) {
		if (showExportMenu && !(e.target as HTMLElement)?.closest('.export-pdf-menu')) {
			showExportMenu = false;
		}
	}
</script>

<svelte:window onclick={closeMenusOnWindowClick} />

<div
	class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
>
	<ProjectLanguagePicker {projectId} currentLang={lang} {availableLanguages} />
	<a
		class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200"
		href={resolve(`/interview?id=${projectId}&interview_type=manual_test&lang=${lang}`)}
		target="_blank"
		rel="opener"
	>
		<i class="fa-solid fa-person-circle-question"></i>
		Try Interview
	</a>
	<div class="export-pdf-menu relative">
		<button
			type="button"
			class="rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
			onclick={() => {
				if (!canExport) return;
				showExportMenu = !showExportMenu;
			}}
			disabled={exporting || !canExport}
			title={!canExport ? 'Export is only available for interview guides' : undefined}
		>
			<i class="fa-solid fa-file-export"></i>
			{exporting ? 'Exporting...' : 'Export'}
		</button>
		{#if showExportMenu}
			<div
				class="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
			>
				{#if onExportPdf}
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
						onclick={() => {
							onExportPdf?.();
							showExportMenu = false;
						}}
					>
						<i class="fa-solid fa-file-lines"></i>
						PDF
					</button>
				{/if}
				{#if onExportJson}
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
						onclick={() => {
							onExportJson?.();
							showExportMenu = false;
						}}
					>
						<i class="fa-solid fa-file-code"></i>
						JSON
					</button>
				{/if}
			</div>
		{/if}
	</div>
	<button
		type="button"
		class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:opacity-50"
		onclick={() => onSave()}
		disabled={saving}
	>
		<i class="fa-solid fa-floppy-disk"></i>
		{saveLabel}
	</button>
</div>
