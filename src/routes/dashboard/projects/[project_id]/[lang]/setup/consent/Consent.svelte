<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { LanguageDict, Welcome } from '$lib/api/types.gen';
	import { ConsentModal } from '$lib/components/modals';
	import { toast } from 'svelte-sonner';
	import SetupActionBar from '../SetupActionBar.svelte';
	import { downloadUnifiedSetupJson } from '../exportJson';
	import ExportPdfModal from '../ExportPdfModal.svelte';
	import { downloadGuidePdf, type PdfToggles } from '../exportPdf';
	import { mapToLocal } from '../guide/utils';

	interface Props {
		initialData?: { title: string; text: string } | null;
		availableLanguages?: LanguageDict[];
		projectName?: string;
	}

	let {
		initialData = null,
		availableLanguages: initialAvailableLanguages = [],
		projectName = 'Interview Guide'
	}: Props = $props();

	let projectId = $derived(page.params.project_id ?? '');
	let language = $derived(page.params.lang ?? '');
	let platformVersion = $derived(page.data.platformVersion?.platform_version ?? null);
	// svelte-ignore state_referenced_locally
	let title = $state(initialData?.title || '');
	// svelte-ignore state_referenced_locally
	let text = $state(initialData?.text || '');
	let showFullscreenModal = $state(false);
	let saving = $state(false);
	let exporting = $state(false);
	const availableLanguages = $derived<LanguageDict[]>(initialAvailableLanguages);

	function getSnapshot() {
		return JSON.stringify({ title, text });
	}

	let savedSnapshot = $state(getSnapshot());

	beforeNavigate(({ cancel }) => {
		if (getSnapshot() !== savedSnapshot) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
				cancel();
			}
		}
	});

	async function saveConsent() {
		saving = true;
		const { error } = await Projects.createConsent({
			path: { project_id: projectId, language: language },
			body: { title, text }
		});

		if (!error) {
			savedSnapshot = getSnapshot();
			await invalidateAll();
			toast.success('Consent saved successfully.');
		} else {
			toast.error('Error when saving consent.');
		}
		saving = false;
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

	async function fetchWelcome(): Promise<Welcome | null> {
		const { data } = await Projects.getWelcome({
			path: { project_id: projectId, language: language }
		});
		return data ?? null;
	}

	async function handleExportPdf(toggles: PdfToggles) {
		exporting = true;
		try {
			const guide = await getGuideForExport();
			const mapped = mapToLocal(guide);
			const welcome = toggles.welcome ? await fetchWelcome() : null;
			const consent = toggles.consent ? { title, text } : null;
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
			const [guideRes, welcomeRes] = await Promise.allSettled([
				getGuideForExport(),
				fetchWelcome()
			]);

			downloadUnifiedSetupJson({
				consent: title || text ? { title, text } : null,
				welcome: welcomeRes.status === 'fulfilled' ? welcomeRes.value : null,
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
		<h1 class="page-title">Consent</h1>
		<p class="mt-2 text-gray-600">
			Configure the consent message users must accept before starting the interview.
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
						<label for="consent-title" class="mb-1.5 block text-sm font-medium text-gray-700">
							Title
						</label>
						<input
							autocomplete="off"
							id="consent-title"
							bind:value={title}
							placeholder="e.g., Consent to Participate"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none"
						/>
					</div>

					<div>
						<label for="consent-text" class="mb-1.5 block text-sm font-medium text-gray-700">
							Message
						</label>
						<textarea
							autocomplete="off"
							id="consent-text"
							bind:value={text}
							placeholder="Write the consent information that participants must agree to before starting the interview..."
							rows="12"
							class="block w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-primary focus:ring-primary focus:outline-none"
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
					<div class="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl">
						<!-- Simulated Modal -->
						<div class="max-h-[500px] overflow-y-auto p-6">
							<h2 class="mb-4 text-xl font-bold text-gray-900">
								{title || 'Consent Title'}
							</h2>
							<div class="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
								{#if text}
									{@html text}
								{:else}
									<span class="text-gray-400 italic">
										Your consent message will appear here...
									</span>
								{/if}
							</div>
							<div class="mt-6 flex gap-3">
								<button
									class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
									disabled
								>
									Accept
								</button>
								<button
									class="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300"
									disabled
								>
									Decline
								</button>
							</div>
						</div>
					</div>
				</div>

				<p class="mt-3 text-center text-xs text-gray-500">
					This is how participants will see the consent dialog.
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
