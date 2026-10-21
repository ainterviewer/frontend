<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProjectLanguage } from '$lib/api/types.gen';
	import ProjectLanguagePicker from '$lib/components/projectLanguage/ProjectLanguagePicker.svelte';
	import PublishControl from '$lib/content/PublishControl.svelte';

	let {
		projectId,
		lang,
		availableLanguages = [],
		exporting = false,
		onBeforePublish,
		onExportPdf,
		onExportJson
	}: {
		projectId: string;
		lang: string;
		availableLanguages?: ProjectLanguage[];
		exporting?: boolean;
		/** Run before publishing; `false` stops it. */
		onBeforePublish?: () => Promise<boolean | void> | boolean | void;
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

<div class="@container sticky bottom-0 w-full">
	<!-- The bar sizes its labels off its own available width, not the viewport: the
	     page's side panel makes the viewport a poor proxy for the room left here.
	     Too little room and every label drops at once, leaving icon-only pills -- the
	     bar never wraps, so it stays one row at any width. A comment must not lead
	     this template: as a second root node it breaks hydration where the component
	     sits next to siblings. -->
	<div
		data-action-bar
		class="ml-auto flex w-fit max-w-full flex-nowrap items-center justify-end gap-2 rounded-full border border-gray-200 bg-white/90 p-2 shadow-lg backdrop-blur @3xl:gap-4 @3xl:p-4"
	>
		<div data-tour="language" class="flex">
			<ProjectLanguagePicker {projectId} currentLang={lang} {availableLanguages} />
		</div>
		<div data-tour="export" class="export-pdf-menu relative">
			<button
				type="button"
				class="rounded-full bg-gray-100 px-4 py-2 font-medium whitespace-nowrap text-gray-700 hover:bg-gray-200 disabled:opacity-50 @3xl:px-6"
				onclick={() => {
					if (!canExport) return;
					showExportMenu = !showExportMenu;
				}}
				disabled={exporting || !canExport}
				title={!canExport ? 'Export is only available for interview guides' : 'Export'}
				aria-label="Export"
			>
				<i class="fa-solid fa-file-export"></i>
				<span class="hidden @3xl:inline">{exporting ? 'Exporting...' : 'Export'}</span>
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
		<div class="flex">
			<!-- Try Interview beside Publish: test the draft, then send it out. -->
			<PublishControl {projectId} {lang} {availableLanguages} {onBeforePublish} primary>
				{#snippet beside()}
					<a
						data-tour="try-interview"
						class="rounded-full border border-primary px-4 py-2 font-medium whitespace-nowrap text-primary hover:bg-primary/10 @3xl:px-6"
						href={resolve(`/interview?id=${projectId}&interview_type=manual_test&lang=${lang}`)}
						target="_blank"
						rel="opener"
						title="Try Interview"
						aria-label="Try Interview"
					>
						<i class="fa-solid fa-person-circle-question"></i>
						<span class="hidden @3xl:inline">Try Interview</span>
					</a>
				{/snippet}
			</PublishControl>
		</div>
	</div>
</div>
