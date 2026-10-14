<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { Consent, LocalizedWelcome, ProjectLanguage } from '$lib/api/types.gen';
	import { WelcomeModal } from '$lib/components/modals';
	import WelcomePreview from '$lib/components/preview/WelcomePreview.svelte';
	import { contentRevision, isStale, saveWithRevision } from '$lib/content/revision.svelte';

	import { downloadUnifiedSetupJson } from '../exportJson';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import { isUntranslated, pick } from '../guide/localized';
	import { renderSaved } from '../guide/render';
	import SetupActionBar from '../SetupActionBar.svelte';
	import TranslationBanner from '../TranslationBanner.svelte';

	interface Props {
		initialData?: LocalizedWelcome | null;
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
	const initialVideoFileName = $derived(initialData?.video_file_name || null);

	let projectId = $derived(page.params.project_id ?? '');

	// Adopted once, at mount: the revision the content on screen was loaded
	// at. Later ones come only from this page's own saves, so reloading the
	// page data (which the parent keys this component on) cannot make stale
	// edits look current.
	onMount(() => contentRevision.set(projectId, revision));
	let language = $derived(page.params.lang ?? '');
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);

	// Title and text in every language; this page edits `language`'s. The
	// email, video and id setting are shared by every language.
	// svelte-ignore state_referenced_locally
	let texts = $state({
		title: { ...(initialData?.title ?? {}) },
		text: { ...(initialData?.text ?? {}) }
	});
	// svelte-ignore state_referenced_locally
	let email = $state(initialData?.email || '');
	// svelte-ignore state_referenced_locally
	let withId = $state(initialData?.with_id ?? true);

	let videoFileName = $state<string | null>(untrack(() => initialVideoFileName));
	let videoFile = $state<File | null>(null);

	let showFullscreenModal = $state(false);
	let saving = $state(false);
	let exporting = $state(false);
	const availableLanguages = $derived<ProjectLanguage[]>(initialAvailableLanguages);
	let defaultLang = $derived(availableLanguages.find((l) => l.is_default)?.code ?? language);
	let languages = $derived([language, defaultLang]);

	// What respondents in `language` see: untranslated text is the default's.
	let title = $derived(pick(texts.title, languages));
	let text = $derived(pick(texts.text, languages));

	let videoPreviewUrl = $state<string | null>(null);

	function getSnapshot() {
		return JSON.stringify({ texts, email, videoFileName, hasPendingUpload: !!videoFile });
	}

	let savedSnapshot = $state(getSnapshot());

	beforeNavigate(({ cancel }) => {
		if (getSnapshot() !== savedSnapshot) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
				cancel();
			}
		}
	});

	$effect(() => {
		let url: string | null = null;
		if (videoFile) {
			url = URL.createObjectURL(videoFile);
			videoPreviewUrl = url;
		} else if (videoFileName) {
			// FIXME: Unify shared storage location between backend and frontend
			videoPreviewUrl = `/assets/videos/${videoFileName}`;
		} else {
			videoPreviewUrl = null;
		}

		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	async function loadData() {
		if (!projectId) return;
		const { data, error, response } = await Projects.getLocalizedWelcome({
			path: { project_id: projectId }
		});
		contentRevision.take(projectId, response);
		if (error) {
			console.error('Failed to load welcome data:', error);
			toast.error('Failed to load welcome data.');
			return;
		}
		if (data) {
			texts = { title: { ...(data.title ?? {}) }, text: { ...(data.text ?? {}) } };
			email = data.email;
			withId = data.with_id ?? true;
			videoFileName = data.video_file_name || null;
		}
	}

	async function saveWelcome(): Promise<boolean> {
		let saved = false;
		saving = true;

		// The video is shared by every language: stored first, then named in
		// the welcome.
		let video_file_name = videoFileName;
		if (videoFile) {
			const upload = await Projects.uploadWelcomeVideo({
				path: { project_id: projectId },
				body: { video: videoFile }
			});
			if (upload.error || !upload.data) {
				toast.error('Error when uploading the video.');
				saving = false;
				return false;
			}
			video_file_name = upload.data;
		}

		const body = { ...texts, email, video_file_name, with_id: withId };
		const result = await saveWithRevision(projectId, 'the welcome screen', (headers) =>
			Projects.updateWelcome({ path: { project_id: projectId }, body, headers })
		);

		if (isStale(result)) {
			// Told already; the unsaved edits stay on screen.
		} else if (!result.error) {
			savedSnapshot = getSnapshot();
			await invalidateAll();
			saved = true;
			toast.success('Welcome saved successfully.');
			loadData();
			videoFile = null;
		} else {
			toast.error('Error when saving welcome.');
		}
		saving = false;
		return saved;
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			videoFile = input.files[0];
		}
	}

	function removeVideo() {
		videoFile = null;
		videoFileName = null;
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

	async function fetchConsent(): Promise<Consent | null> {
		// The draft's, like the welcome being exported.
		const { data } = await Projects.getConsent({
			path: { project_id: projectId, language: language },
			query: { draft: true }
		});
		return data ?? null;
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const { guide, sections, questions } = await getGuideForExport();
			const consent = toggles.consent ? await fetchConsent() : null;
			const welcome = toggles.welcome
				? { title, text, email, video_file_name: videoFileName ?? null }
				: null;
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
			const [guideRes, consentRes] = await Promise.allSettled([
				getGuideForExport(),
				fetchConsent()
			]);

			downloadUnifiedSetupJson({
				consent: consentRes.status === 'fulfilled' ? consentRes.value : null,
				welcome:
					title || text || email || videoFileName
						? {
								title,
								text,
								email,
								video_file_name: videoFileName ?? null
							}
						: null,
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
		[texts.title, texts.text].filter((t) => isUntranslated(t, language)).length
	);
	let translating = $state(false);

	// Machine-translates what this language lacks -- here and in the guide --
	// from the default language. The server translates what is saved, so
	// unsaved edits are saved first.
	async function translateMissing() {
		if (getSnapshot() !== savedSnapshot) await saveWelcome();
		if (getSnapshot() !== savedSnapshot) return;
		translating = true;
		const { data, error } = await Projects.translateMissing({
			path: { project_id: projectId, lang: language }
		});
		translating = false;
		if (error || !data?.welcome) {
			console.error('Failed to translate', error);
			toast.error('Failed to translate the missing text');
			return;
		}
		texts.title = { ...(data.welcome.title ?? {}) };
		texts.text = { ...(data.welcome.text ?? {}) };
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
		<h1 class="page-title">Welcome</h1>
		<p class="mt-2 text-gray-600">
			Configure the welcome message, video, and contact information shown before the interview
			begins.
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
						<label for="welcome-title" class="mb-1.5 block text-sm font-medium text-gray-700">
							Title
						</label>
						<input
							autocomplete="off"
							id="welcome-title"
							bind:value={texts.title[language]}
							placeholder={isUntranslated(texts.title, language)
								? title
								: 'e.g., Thank you for participating!'}
							class={[
								'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(texts.title, language) && 'border-amber-400 bg-amber-50'
							]}
						/>
					</div>

					<div>
						<label for="welcome-video" class="mb-1.5 block text-sm font-medium text-gray-700">
							Video (optional)
						</label>
						<div class="flex items-center gap-3">
							<label
								class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50"
							>
								<i class="fa-solid fa-upload text-gray-400"></i>
								Choose file
								<input
									autocomplete="off"
									id="welcome-video"
									type="file"
									accept=".mp4"
									onchange={handleFileChange}
									class="hidden"
								/>
							</label>
							{#if videoFileName || videoFile}
								<span class="text-sm text-gray-600">
									{videoFile?.name || videoFileName}
								</span>
								<button
									type="button"
									onclick={removeVideo}
									class="text-sm text-red-600 hover:text-red-700"
								>
									Remove
								</button>
							{:else}
								<span class="text-sm text-gray-400">No file selected</span>
							{/if}
						</div>
						<p class="mt-1.5 text-xs text-gray-500">MP4 format recommended. Max 50MB.</p>
					</div>

					<div>
						<label for="welcome-text" class="mb-1.5 block text-sm font-medium text-gray-700">
							Welcome Message
						</label>
						<textarea
							autocomplete="off"
							id="welcome-text"
							bind:value={texts.text[language]}
							placeholder={isUntranslated(texts.text, language)
								? text
								: 'Write your welcome message here. This will be shown to participants before they start the interview...'}
							rows="8"
							class={[
								'block w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(texts.text, language) && 'border-amber-400 bg-amber-50'
							]}
						></textarea>
					</div>

					<div>
						<label
							for="welcome-email"
							class="required mb-1.5 block text-sm font-medium text-gray-700"
						>
							Contact Email
						</label>
						<input
							required
							autocomplete="email"
							id="welcome-email"
							type="email"
							bind:value={email}
							placeholder="e.g., contact@university.edu"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none"
						/>
						<p class="mt-1.5 text-xs text-gray-500">
							Participants can contact this email to withdraw consent or modify their data.
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
					<WelcomePreview {title} {text} videoUrl={videoPreviewUrl} {email} />
				</div>

				<p class="mt-3 text-center text-xs text-gray-500">
					This is how participants will see the welcome screen.
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
			onSave={saveWelcome}
			onExportPdf={() => {
				showExportPdfModal = true;
			}}
			onExportJson={exportJson}
		/>
	</div>
</div>

<ExportPdfModal bind:open={showExportPdfModal} {exporting} onExport={handleExportPdf} />

<!-- Fullscreen Modal Preview -->
<WelcomeModal
	show={showFullscreenModal}
	{title}
	{text}
	videoUrl={videoPreviewUrl}
	{email}
	onProceed={() => (showFullscreenModal = false)}
	onClose={() => (showFullscreenModal = false)}
	isPreview={true}
/>
