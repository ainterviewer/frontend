<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ContentError, ProjectLanguage } from '$lib/api/types.gen';
	import type { LivePart } from '$lib/collab/contentSession.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import ProjectLanguagePicker from '$lib/components/projectLanguage/ProjectLanguagePicker.svelte';
	import { fixFirst, testSkips, WOULD } from '$lib/content/invalidParts';
	import PublishControl from '$lib/content/PublishControl.svelte';

	import ShareTestLink from './ShareTestLink.svelte';

	let {
		projectId,
		lang,
		availableLanguages = [],
		exporting = false,
		part,
		errors,
		onBeforePublish,
		onExportPdf,
		onExportJson
	}: {
		projectId: string;
		lang: string;
		availableLanguages?: ProjectLanguage[];
		exporting?: boolean;
		/** The part this page edits live. */
		part: LivePart;
		/** Why it is invalid, as it stands now. */
		errors: ContentError[];
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

{#snippet refused(reason: string)}
	<span class="flex gap-2">
		<i class="fas fa-triangle-exclamation mt-0.5 text-red-500" aria-hidden="true"></i>
		<span>{reason}</span>
	</span>
{/snippet}

<ActionBar>
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
		<PublishControl
			{projectId}
			{lang}
			{availableLanguages}
			{onBeforePublish}
			live={{ part, errors }}
			primary
		>
			{#snippet beside(invalid, skipped)}
				{@const tryBlocked = fixFirst(invalid, WOULD.try)}
				{@const skips = testSkips(skipped)}
				<ShareTestLink {projectId} dataTour="share-test" blocked={fixFirst(invalid, WOULD.share)} />
				{#if tryBlocked}
					<!-- Not a link while a part is invalid: a test would run it as it
					     was before its problems. -->
					<HoverInfo asChild>
						{#snippet content()}
							{@render refused(tryBlocked)}
						{/snippet}
						{#snippet children({ props })}
							<span
								{...props}
								data-tour="try-interview"
								role="link"
								aria-disabled="true"
								tabindex="0"
								class="cursor-not-allowed rounded-full border border-gray-300 px-4 py-2 font-medium whitespace-nowrap text-gray-400 @3xl:px-6"
								aria-label="Try Interview: {tryBlocked}"
							>
								<i class="fa-solid fa-person-circle-question"></i>
								<span class="hidden @3xl:inline">Try Interview</span>
							</span>
						{/snippet}
					</HoverInfo>
				{:else}
					<!-- Questions with no text yet are left out of the draft: the test
					     runs without them, and says so on hover. -->
					<HoverInfo asChild text={skips}>
						{#snippet children({ props })}
							<a
								{...props}
								data-tour="try-interview"
								class="rounded-full border border-primary px-4 py-2 font-medium whitespace-nowrap text-primary hover:bg-primary/10 @3xl:px-6"
								href={resolve(`/interview?id=${projectId}&interview_type=manual_test&lang=${lang}`)}
								target="_blank"
								rel="opener"
								title={skips ? undefined : 'Try Interview'}
								aria-label={skips ? `Try Interview: ${skips}` : 'Try Interview'}
							>
								<i class="fa-solid fa-person-circle-question"></i>
								<span class="hidden @3xl:inline">Try Interview</span>
							</a>
						{/snippet}
					</HoverInfo>
				{/if}
			{/snippet}
		</PublishControl>
	</div>
</ActionBar>
