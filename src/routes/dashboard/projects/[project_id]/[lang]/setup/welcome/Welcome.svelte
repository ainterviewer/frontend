<script lang="ts">
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { Consent, LocalizedWelcome, ProjectLanguage } from '$lib/api/types.gen';
	import { bindFlat } from '$lib/collab/bindFlat.svelte';
	import CollabPill from '$lib/collab/CollabPill.svelte';
	import { acquireContentSession, presenceUser } from '$lib/collab/contentSession.svelte';
	import { presence } from '$lib/collab/presence.svelte';
	import { WelcomeModal } from '$lib/components/modals';
	import WelcomePreview from '$lib/components/preview/WelcomePreview.svelte';

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
	}

	let {
		initialData = null,
		availableLanguages: initialAvailableLanguages = [],
		projectName = 'Interview Guide'
	}: Props = $props();

	// The project a page is for never changes under it.
	const projectId = page.params.project_id ?? '';
	let language = $derived(page.params.lang ?? '');
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);

	/** What a field the doc lacks reads as. */
	const DEFAULTS = {
		title: {},
		text: {},
		email: '',
		with_id: true,
		video_file_name: null
	};

	// The welcome screen as the doc holds it: title and text in every language,
	// of which this page edits `language`'s; the email, video and id setting
	// are shared by every language.
	// svelte-ignore state_referenced_locally
	let welcome = $state<{
		title: Record<string, string>;
		text: Record<string, string>;
		email: string;
		with_id: boolean;
		video_file_name: string | null;
	}>({ ...DEFAULTS, ...structuredClone(initialData ?? {}) });

	/** A video being uploaded: shown while it is, then named in the doc. */
	let videoFile = $state<File | null>(null);

	let showFullscreenModal = $state(false);
	let exporting = $state(false);
	const availableLanguages = $derived<ProjectLanguage[]>(initialAvailableLanguages);

	// Co-edited live, like the guide: every keystroke goes into the shared doc,
	// which the server saves. There is no Save. Viewers see it live and cannot
	// change it.
	const canEdit =
		page.data.user?.scope === 'admin' ||
		page.data.permissions?.role === 'editor' ||
		page.data.permissions?.role === 'admin';
	const session = acquireContentSession(projectId, 'welcome', presenceUser(page.data.user));
	onDestroy(() => session.release());
	const unbind = bindFlat({
		session,
		state: welcome,
		texts: ['title', 'text'],
		defaults: DEFAULTS,
		languages: () => availableLanguages.map((l) => l.code)
	});
	onDestroy(unbind);
	let editable = $derived(canEdit && session.loaded && session.status !== 'refused');
	// The only thing the page can leave invalid: the server refuses a welcome
	// screen without a valid contact email (`_validate_welcome`).
	let emailInvalid = $derived(session.errors.length > 0);
	let defaultLang = $derived(availableLanguages.find((l) => l.is_default)?.code ?? language);
	let languages = $derived([language, defaultLang]);

	// What respondents in `language` see: untranslated text is the default's.
	let title = $derived(pick(welcome.title, languages));
	let text = $derived(pick(welcome.text, languages));

	let videoPreviewUrl = $state<string | null>(null);

	$effect(() => {
		let url: string | null = null;
		if (videoFile) {
			url = URL.createObjectURL(videoFile);
			videoPreviewUrl = url;
		} else if (welcome.video_file_name) {
			// FIXME: Unify shared storage location between backend and frontend
			videoPreviewUrl = `/assets/videos/${welcome.video_file_name}`;
		} else {
			videoPreviewUrl = null;
		}

		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	// The video is shared by every language: stored as soon as it is chosen,
	// then named in the doc, which saves it like any other edit.
	async function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		videoFile = file;
		const upload = await Projects.uploadWelcomeVideo({
			path: { project_id: projectId },
			body: { video: file }
		});
		if (videoFile !== file) return;
		videoFile = null;
		if (upload.error || !upload.data) {
			toast.error('Error when uploading the video.');
			return;
		}
		welcome.video_file_name = upload.data;
	}

	function removeVideo() {
		videoFile = null;
		welcome.video_file_name = null;
	}

	// Before publishing: what is published is what the server has, so this
	// tab's changes must have reached it.
	function readyToPublish(): boolean {
		if (session.status !== 'synced') {
			toast.error('Reconnecting to the server; publish once your changes are saved');
			return false;
		}
		if (videoFile) {
			toast.error('Wait for the video to finish uploading before publishing');
			return false;
		}
		return true;
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
			const welcomeScreen = toggles.welcome
				? {
						title,
						text,
						email: welcome.email,
						video_file_name: welcome.video_file_name ?? null
					}
				: null;
			await downloadGuidePdf({
				guide,
				sections,
				questions,
				projectName,
				platformVersion,
				toggles,
				consent,
				welcome: welcomeScreen
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
					title || text || welcome.email || welcome.video_file_name
						? {
								title,
								text,
								email: welcome.email,
								video_file_name: welcome.video_file_name ?? null
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
		[welcome.title, welcome.text].filter((t) => isUntranslated(t, language)).length
	);
	let translating = $state(false);

	// Machine-translates what this language lacks -- here and in the guide --
	// from the default language. The server saves the doc first and merges the
	// translation into it, so it arrives here like anyone else's edit.
	async function translateMissing() {
		translating = true;
		const { data, error } = await Projects.translateMissing({
			path: { project_id: projectId, lang: language }
		});
		translating = false;
		if (error || !data) {
			console.error('Failed to translate', error);
			toast.error('Failed to translate the missing text');
			return;
		}
		toast.success(`Translated the missing ${languageName} text`);
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		// Changes made offline exist only in this tab until it reconnects, and
		// a video being uploaded is not named in the doc yet.
		if ((session.status === 'offline' && session.unsaved) || videoFile) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

<div class="flex min-h-full flex-col">
	<CollabPill {session} invalidLabel="Invalid: enter a valid contact email" />
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
		inProgress={availableLanguages.find((l) => l.code === language)?.in_progress ?? false}
		{translating}
		disabled={!editable}
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

				<fieldset
					class="min-w-0 space-y-5"
					disabled={!editable}
					use:presence={{ session, isBlock: (id) => id.startsWith('welcome-') }}
				>
					<div>
						<label for="welcome-title" class="mb-1.5 block text-sm font-medium text-gray-700">
							Title
						</label>
						<input
							autocomplete="off"
							id="welcome-title"
							bind:value={welcome.title[language]}
							placeholder={isUntranslated(welcome.title, language)
								? title
								: 'e.g., Thank you for participating!'}
							class={[
								'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(welcome.title, language) && 'border-amber-400 bg-amber-50'
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
							{#if videoFile}
								<span class="text-sm text-gray-600">
									<i class="fa-solid fa-circle-notch mr-1 animate-spin text-gray-400"></i>
									Uploading {videoFile.name}
								</span>
							{:else if welcome.video_file_name}
								<span class="text-sm text-gray-600">
									{welcome.video_file_name}
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
							bind:value={welcome.text[language]}
							placeholder={isUntranslated(welcome.text, language)
								? text
								: 'Write your welcome message here. This will be shown to participants before they start the interview...'}
							rows="8"
							class={[
								'block w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								isUntranslated(welcome.text, language) && 'border-amber-400 bg-amber-50'
							]}></textarea>
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
							bind:value={welcome.email}
							placeholder="e.g., contact@university.edu"
							aria-invalid={emailInvalid}
							aria-describedby={emailInvalid ? 'welcome-email-error' : undefined}
							class={[
								'block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none',
								emailInvalid && 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
							]}
						/>
						{#if emailInvalid}
							<p id="welcome-email-error" class="mt-1.5 text-xs text-red-600">
								Enter a valid email address. Until you do, your changes on this page won't be used
								in tests or published.
							</p>
						{/if}
						<p class="mt-1.5 text-xs text-gray-500">
							Participants can contact this email to withdraw consent or modify their data.
						</p>
					</div>
				</fieldset>

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
					<WelcomePreview {title} {text} videoUrl={videoPreviewUrl} email={welcome.email} />
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
			{exporting}
			onBeforePublish={readyToPublish}
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
	email={welcome.email}
	onProceed={() => (showFullscreenModal = false)}
	onClose={() => (showFullscreenModal = false)}
	isPreview={true}
/>
