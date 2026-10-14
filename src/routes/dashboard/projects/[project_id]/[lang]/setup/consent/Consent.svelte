<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { LocalizedConsent, ProjectLanguage, Welcome } from '$lib/api/types.gen';
	import { ConsentModal } from '$lib/components/modals';
	import ConsentPreview from '$lib/components/preview/ConsentPreview.svelte';
	import { contentRevision, isStale, saveWithRevision } from '$lib/content/revision.svelte';

	import { downloadUnifiedSetupJson } from '../exportJson';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import { isUntranslated, pick } from '../guide/localized';
	import { renderSaved } from '../guide/render';
	import SetupActionBar from '../SetupActionBar.svelte';
	import TranslationBanner from '../TranslationBanner.svelte';

	interface Props {
		initialData?: LocalizedConsent | null;
		availableLanguages?: ProjectLanguage[];
		projectName?: string;
		/** The content revision this was loaded at (its `ETag`). */
		revision?: string | null;
	}

	let {
		initialData = null,
		availableLanguages: initialAvailableLanguages = [],
		projectName = 'Interview Guide',
		revision = null
	}: Props = $props();

	let projectId = $derived(page.params.project_id ?? '');

	// Adopted once, at mount: the revision the content on screen was loaded
	// at. Later ones come only from this page's own saves, so reloading the
	// page data (which the parent keys this component on) cannot make stale
	// edits look current.
	onMount(() => contentRevision.set(projectId, revision));
	let language = $derived(page.params.lang ?? '');
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);
	// The consent in every language; this page edits `language`'s text.
	// svelte-ignore state_referenced_locally
	let consent = $state({
		title: { ...(initialData?.title ?? {}) },
		text: { ...(initialData?.text ?? {}) }
	});
	let showFullscreenModal = $state(false);
	let saving = $state(false);
	let exporting = $state(false);
	const availableLanguages = $derived<ProjectLanguage[]>(initialAvailableLanguages);
	let defaultLang = $derived(availableLanguages.find((l) => l.is_default)?.code ?? language);
	let languages = $derived([language, defaultLang]);

	// What respondents in `language` see: untranslated text is the default's.
	let title = $derived(pick(consent.title, languages));
	let text = $derived(pick(consent.text, languages));

	function getSnapshot() {
		return JSON.stringify(consent);
	}

	let savedSnapshot = $state(getSnapshot());

	beforeNavigate(({ cancel }) => {
		if (getSnapshot() !== savedSnapshot) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
				cancel();
			}
		}
	});

	async function saveConsent(): Promise<boolean> {
		let saved = false;
		saving = true;
		const result = await saveWithRevision(projectId, 'the consent', (headers) =>
			Projects.updateConsent({ path: { project_id: projectId }, body: consent, headers })
		);

		if (isStale(result)) {
			// Told already; the unsaved edits stay on screen.
		} else if (!result.error) {
			savedSnapshot = getSnapshot();
			await invalidateAll();
			saved = true;
			toast.success('Consent saved successfully.');
		} else {
			toast.error('Error when saving consent.');
		}
		saving = false;
		return saved;
	}

	async function getGuideForExport() {
		const { data, error } = await Projects.getLocalizedGuide({
			path: { project_id: projectId }
		});
		if (error || !data) {
			throw new Error('Failed to load interview guide for export.');
		}
		return renderSaved(data, languages);
	}

	let showExportPdfModal = $state(false);

	async function fetchWelcome(): Promise<Welcome | null> {
		// The draft's, like the consent being exported.
		const { data } = await Projects.getWelcome({
			path: { project_id: projectId, language: language },
			query: { draft: true }
		});
		return data ?? null;
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const { guide, sections, questions } = await getGuideForExport();
			const welcome = toggles.welcome ? await fetchWelcome() : null;
			const consent = toggles.consent ? { title, text } : null;
			await downloadGuidePdf({
				guide,
				sections,
				questions,
				projectName,
				platformVersion,
				toggles,
				consent,
				welcome
			});
			showExportPdfModal = false;
		} catch (e) {
			console.error('Failed to export PDF', e);
			toast.error('Failed to export PDF');
		} finally {
			exporting = false;
		}
	}

	async function exportJson() {
		try {
			const [guideRes, welcomeRes] = await Promise.allSettled([
				getGuideForExport(),
				fetchWelcome()
			]);

			downloadUnifiedSetupJson({
				consent: title || text ? { title, text } : null,
				welcome: welcomeRes.status === 'fulfilled' ? welcomeRes.value : null,
				interview_guide: guideRes.status === 'fulfilled' ? guideRes.value.guide : null,
				platform_version: platformVersion
			});
		} catch (e) {
			console.error('Failed to export JSON', e);
			toast.error('Failed to export JSON');
		}
	}

	let languageName = $derived(
		availableLanguages.find((l) => l.code === language)?.name ?? language
	);
	let defaultLanguageName = $derived(
		availableLanguages.find((l) => l.code === defaultLang)?.name ?? defaultLang
	);
	let untranslated = $derived(
		[consent.title, consent.text].filter((t) => isUntranslated(t, language)).length
	);
	let translating = $state(false);

	// Machine-translates what this language lacks -- here and in the guide --
	// from the default language. The server translates what is saved, so
	// unsaved edits are saved first.
	async function translateMissing() {
		if (getSnapshot() !== savedSnapshot) await saveConsent();
		if (getSnapshot() !== savedSnapshot) return;
		translating = true;
		const { data, error } = await Projects.translateMissing({
			path: { project_id: projectId, lang: language }
		});
		translating = false;
		if (error || !data?.consent) {
			console.error('Failed to translate', error);
			toast.error('Failed to translate the missing text');
			return;
		}
		consent.title = { ...(data.consent.title ?? {}) };
		consent.text = { ...(data.consent.text ?? {}) };
		savedSnapshot = getSnapshot();
		toast.success(`Translated the missing ${languageName} text`);
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (getSnapshot() !== savedSnapshot) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

<div class="flex min-h-full flex-col">
	<div class="mb-6">
		<h1 class="page-title">Consent</h1>
		<p class="mt-2 text-gray-600">
			Configure the consent message users must accept before starting the interview.
		</p>
	</div>

	<TranslationBanner
		{languageName}
		{defaultLanguageName}
		isDefault={language === defaultLang}
		{untranslated}
		{translating}
		disabled={saving}
		onTranslate={translateMissing}
	/>

	<div class="flex gap-8">
		<!-- Editor Panel -->
		<div class="min-w-0 flex-1">
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-medium text-gray-900">
					<i class="fa-solid fa-pen-to-square mr-2 text-gray-400"></i>
					Edit Content
				</h3>

				<div class="space-y-5">
					<div>
						<label for="consent-title" class="mb-1.5 block text-sm font-medium text-gray-700">
							Title
						</label>
						<input
							autocomplete="off"
							id="consent-title"
							bind:value={consent.title[language]}
							placeholder={isUntranslated(consent.title, language)
								? title
								: 'e.g., Consent to Participate'}
							class={[
								'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(consent.title, language) && 'border-amber-400 bg-amber-50'
							]}
						/>
					</div>

					<div>
						<label for="consent-text" class="mb-1.5 block text-sm font-medium text-gray-700">
							Message
						</label>
						<textarea
							autocomplete="off"
							id="consent-text"
							bind:value={consent.text[language]}
							placeholder={isUntranslated(consent.text, language)
								? text
								: 'Write the consent information that participants must agree to before starting the interview...'}
							rows="12"
							class={[
								'block w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(consent.text, language) && 'border-amber-400 bg-amber-50'
							]}
						></textarea>
						<p class="mt-1.5 text-xs text-gray-500">
							Supports plain text with line breaks preserved.
						</p>
					</div>
				</div>

				<!-- Actions -->
				<div class="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5">
					<button
						type="button"
						onclick={() => (showFullscreenModal = true)}
						class="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
					>
						<i class="fa-solid fa-expand"></i>
						Fullscreen Preview
					</button>
				</div>
			</div>
		</div>

		<!-- Live Preview Panel -->
		<div id="preview" class="w-[420px] shrink-0">
			<div class="sticky top-6">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-sm font-medium text-gray-500">
						<i class="fa-solid fa-eye mr-1.5"></i>
						Live Preview
					</h3>
				</div>

				<!-- Modal Preview Container -->
				<div class="rounded-lg border border-gray-200 bg-gray-100 p-4 shadow-inner">
					<ConsentPreview {title} {text} />
				</div>

				<p class="mt-3 text-center text-xs text-gray-500">
					This is how participants will see the consent dialog.
				</p>
			</div>
		</div>
	</div>

	<!-- display:contents, not a plain wrapper: a sticky element cannot leave its
	     parent's box, so a wrapper with a box of its own would pin the bar to its
	     flow position instead of the foot of the scroll container. The spacer takes
	     the free space that the wrapper's mt-auto used to. -->
	<div class="contents">
		<div aria-hidden="true" class="mt-auto h-6"></div>
		<SetupActionBar
			{projectId}
			lang={language}
			{availableLanguages}
			{saving}
			{exporting}
			onSave={saveConsent}
			onExportPdf={() => {
				showExportPdfModal = true;
			}}
			onExportJson={exportJson}
		/>
	</div>
</div>

<ExportPdfModal bind:open={showExportPdfModal} {exporting} onExport={handleExportPdf} />

<!-- Fullscreen Modal Preview -->
<ConsentModal
	show={showFullscreenModal}
	{title}
	{text}
	onAccept={() => (showFullscreenModal = false)}
	onDecline={() => (showFullscreenModal = false)}
	onClose={() => (showFullscreenModal = false)}
	isPreview={true}
/>
