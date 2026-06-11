<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { Consent, LanguageDict } from '$lib/api/types.gen';
	import { WelcomeModal } from '$lib/components/modals';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import SetupActionBar from '../SetupActionBar.svelte';
	import { downloadUnifiedSetupJson } from '../exportJson';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import { mapToLocal } from '../guide/utils';

	interface Props {
		initialData?: {
			title: string;
			text: string;
			email: string;
			video_file_name?: string | null;
		} | null;
		availableLanguages?: LanguageDict[];
		projectName?: string;
	}

	let {
		initialData = null,
		availableLanguages: initialAvailableLanguages = [],
		projectName = 'Interview Guide'
	}: Props = $props();
	const initialVideoFileName = $derived(initialData?.video_file_name || null);

	let projectId = $derived(page.params.project_id ?? '');
	let language = $derived(page.params.lang ?? '');
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);

	// svelte-ignore state_referenced_locally
	let title = $state(initialData?.title || '');
	// svelte-ignore state_referenced_locally
	let text = $state(initialData?.text || '');
	// svelte-ignore state_referenced_locally
	let email = $state(initialData?.email || '');

	let videoFileName = $state<string | null>(untrack(() => initialVideoFileName));
	let videoFile = $state<File | null>(null);

	let showFullscreenModal = $state(false);
	let saving = $state(false);
	let exporting = $state(false);
	const availableLanguages = $derived<LanguageDict[]>(initialAvailableLanguages);

	let videoPreviewUrl = $state<string | null>(null);

	function getSnapshot() {
		return JSON.stringify({ title, text, email, videoFileName, hasPendingUpload: !!videoFile });
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
		const { data, error } = await Projects.getWelcome({
			path: { project_id: projectId, language: language }
		});
		if (error) {
			console.error('Failed to load welcome data:', error);
			toast.error('Failed to load welcome data.');
			return;
		}
		if (data) {
			title = data.title;
			text = data.text;
			email = data.email;
			videoFileName = data.video_file_name || null;
		}
	}

	async function saveWelcome() {
		saving = true;
		const body = {
			title,
			text,
			email,
			video: videoFile || null
		};

		const { error } = await Projects.createWelcome({
			path: { project_id: projectId, language: language },
			body: body
		});

		if (!error) {
			savedSnapshot = getSnapshot();
			await invalidateAll();
			toast.success('Welcome saved successfully.');
			loadData();
			videoFile = null;
		} else {
			toast.error('Error when saving welcome.');
		}
		saving = false;
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
		const { data, error } = await Projects.getGuide({
			path: { project_id: projectId, lang: language }
		});
		if (error || !data) {
			throw new Error('Failed to load interview guide for export.');
		}
		return data;
	}

	let showExportPdfModal = $state(false);

	async function fetchConsent(): Promise<Consent | null> {
		const { data } = await Projects.getConsent({
			path: { project_id: projectId, language: language }
		});
		return data ?? null;
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const guide = await getGuideForExport();
			const mapped = mapToLocal(guide);
			const consent = toggles.consent ? await fetchConsent() : null;
			const welcome = toggles.welcome
				? { title, text, email, video_file_name: videoFileName ?? null }
				: null;
			await downloadGuidePdf({
				guide,
				sections: mapped.sections,
				questions: mapped.questions,
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
				interview_guide: guideRes.status === 'fulfilled' ? guideRes.value : null,
				platform_version: platformVersion
			});
		} catch (e) {
			console.error('Failed to export JSON', e);
			toast.error('Failed to export JSON');
		}
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
							bind:value={title}
							placeholder="e.g., Thank you for participating!"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none"
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
							bind:value={text}
							placeholder="Write your welcome message here. This will be shown to participants before they start the interview..."
							rows="8"
							class="block w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none"
						></textarea>
					</div>

					<div>
						<label for="welcome-email" class="mb-1.5 block text-sm font-medium text-gray-700">
							Contact Email
						</label>
						<input
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
					<div class="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl">
						<!-- Simulated Modal -->
						<div class="max-h-[600px] overflow-y-auto p-6">
							<h2 class="mb-4 text-xl font-bold text-gray-900">
								{title || 'Welcome Title'}
							</h2>

							{#if videoPreviewUrl}
								<div class="mb-4 overflow-hidden rounded-lg bg-black">
									<video controls class="w-full">
										<source src={videoPreviewUrl} type="video/mp4" />
										Your browser does not support the video tag.
									</video>
								</div>
							{/if}

							<div class="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
								{#if text}
									{@html text}
								{:else}
									<span class="text-gray-400 italic">
										Your welcome message will appear here...
									</span>
								{/if}
							</div>

							<hr class="my-4 border-gray-200" />

							<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
								<p class="mb-2">
									If you wish to withdraw your consent or change your answers, please contact
									{#if email}
										<a href="mailto:{email}" class="font-medium text-primary hover:underline">
											{email}
										</a>
									{:else}
										<span class="text-gray-400">[contact email]</span>
									{/if}
									with a reference to the following code:
								</p>

								<div
									class="my-2 flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
								>
									<code class="font-mono text-sm text-gray-700">&lt;interview-id&gt;</code>
									<i class="fa-solid fa-fingerprint text-gray-400"></i>
								</div>

								<p class="text-xs text-gray-500">
									It is your own responsibility to store this code securely before starting the
									interview.
								</p>
							</div>

							<div class="mt-6">
								<button
									class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
									disabled
								>
									Start Interview
								</button>
							</div>
						</div>
					</div>
				</div>

				<p class="mt-3 text-center text-xs text-gray-500">
					This is how participants will see the welcome screen.
				</p>
			</div>
		</div>
	</div>

	<div class="mt-auto pt-6">
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

<style>
	#preview :global(a) {
		color: #2563eb;
		text-decoration: underline;
		font-weight: 500;
		transition:
			color 0.2s ease,
			text-decoration-color 0.2s ease;
	}
	#preview :global(a):hover {
		color: #1547b0;
		cursor: pointer;
	}
	#preview :global(a):active {
		color: #0f2d6e;
	}
</style>
