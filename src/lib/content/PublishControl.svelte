<script lang="ts" module>
	import type { ContentStatus } from '$lib/api/types.gen';

	// The last status seen per project, so the action bar a sub-route mounts
	// draws it straight away instead of flashing empty until the fetch returns.
	// Only ever written in the browser: effects do not run on the server.
	// Read once, at mount, so a plain record rather than reactive state.
	const lastStatus: Record<string, ContentStatus> = {};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { Versions } from '$lib/api';
	import type { ProjectLanguage } from '$lib/api/types.gen';
	import { hasErrorCode } from '$lib/utils/errors';
	import { portal } from '$lib/utils/portal';
	import { toastApiError } from '$lib/utils/toast';

	import { contentRevision, saveWithRevision } from './revision.svelte';
	import { allowedBumps, type Bump, BUMP_MEANING, nextVersion } from './semver';
	import VersionHistory from './VersionHistory.svelte';

	let {
		projectId,
		lang,
		availableLanguages = [],
		onBeforePublish,
		primary = false,
		beside
	}: {
		projectId: string;
		lang: string;
		availableLanguages?: ProjectLanguage[];
		/**
		 * Saves the page's unsaved edits, so what is published is what is on
		 * screen. Resolving to `false` stops the publish.
		 */
		onBeforePublish?: () => Promise<boolean | void> | boolean | void;
		/** The page's main action, filled: where nothing else is (no Save). */
		primary?: boolean;
		/** Drawn right before the Publish button, after the history. */
		beside?: Snippet;
	} = $props();

	// svelte-ignore state_referenced_locally
	let status = $state<ContentStatus | null>(lastStatus[projectId] ?? null);
	let dialogOpen = $state(false);
	let historyOpen = $state(false);
	let publishing = $state(false);
	let label = $state('');
	let bump = $state<Bump>('patch');

	// The status's `ETag` is the whole content's revision, which publishing
	// writes against: publishing anything changed after the dialog showed it
	// would release work nobody reviewed. The parts' revisions, which the
	// editors write against, are theirs alone.
	async function loadStatus() {
		const { data, response } = await Versions.getContentStatus({
			path: { project_id: projectId }
		});
		status = data ?? null;
		if (data) lastStatus[projectId] = data;
		contentRevision.take(projectId, 'content', response);
	}

	// Again whenever anything here saves: the badge follows the draft.
	$effect(() => {
		void contentRevision.changes;
		void projectId;
		loadStatus();
	});

	const pending = $derived<Bump>(status?.pending_bump ?? 'major');
	const choices = $derived(allowedBumps(pending === 'none' ? 'patch' : pending));
	const target = $derived(nextVersion(status?.next_semver ?? '1.0.0', pending, bump));
	const missing = $derived(Object.entries(status?.missing ?? {}));
	const blocked = $derived(missing.length > 0);

	function languageName(code: string) {
		return availableLanguages.find((l) => l.code === code)?.name ?? code;
	}

	async function openDialog() {
		// Save first: the dialog describes the saved draft.
		if (onBeforePublish && (await onBeforePublish()) === false) return;
		await loadStatus();
		bump = pending === 'none' ? 'patch' : pending;
		label = '';
		dialogOpen = true;
	}

	async function publish() {
		publishing = true;
		const result = await saveWithRevision(projectId, 'content', 'the publish dialog', (headers) =>
			Versions.saveContentVersion({
				path: { project_id: projectId },
				body: { publish: true, label: label.trim() || null, bump },
				headers
			})
		);
		publishing = false;
		if (hasErrorCode(result.error, 'stale_revision')) return;
		if (result.error || !result.data) {
			toastApiError(result.error, 'Failed to publish');
			return;
		}
		dialogOpen = false;
		toast.success(`Published version ${result.data.semver}`);
		await loadStatus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dialogOpen = false;
	}
</script>

<svelte:window onkeydown={dialogOpen ? handleKeydown : undefined} />

<div class="flex items-center gap-2">
	<button
		data-tour="version-history"
		type="button"
		class="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-sm font-medium whitespace-nowrap text-gray-700 hover:bg-gray-200"
		onclick={() => {
			// Restoring writes against the content as the history shows it.
			historyOpen = true;
			void loadStatus();
		}}
		title="Version history"
		aria-label="Version history"
	>
		<i class="fa-solid fa-clock-rotate-left"></i>
		{#if status?.published}
			<span class="hidden @3xl:inline">v{status.published.semver}</span>
		{:else if status}
			<span class="hidden @3xl:inline">Not published</span>
		{/if}
		{#if status?.has_unpublished_changes}
			<span
				class="h-2 w-2 rounded-full bg-amber-500"
				title="The draft has changes respondents do not see yet"
			></span>
		{/if}
	</button>
	{@render beside?.()}
	<button
		data-tour="publish"
		type="button"
		class={[
			'flex items-center gap-2 rounded-full border border-primary px-4 py-2 font-medium whitespace-nowrap disabled:opacity-50 @3xl:px-6',
			primary ? 'bg-primary text-white shadow-sm hover:bg-dark' : 'text-primary hover:bg-primary/10'
		]}
		onclick={openDialog}
		disabled={publishing}
		title="Publish the draft to respondents"
		aria-label="Publish"
	>
		<i class="fa-solid fa-upload"></i>
		<span class="hidden @3xl:inline">Publish</span>
	</button>
</div>

{#if dialogOpen && status}
	<!-- Portalled: the action bar's backdrop-filter would otherwise be the
	     containing block of this fixed overlay, and clip it to the bar. -->
	<div
		use:portal
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="publish-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close"
			onclick={() => (dialogOpen = false)}
			tabindex="-1"
		></button>

		<div
			class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
		>
			<div class="px-6 pt-5 pb-4">
				<h3 id="publish-title" class="text-base font-semibold text-gray-900">
					{#if status.published}
						Publish version {target}
					{:else}
						Publish the first version
					{/if}
				</h3>
				<p class="mt-1 text-sm text-gray-500">
					Respondents get the published version: the guide, consent, welcome screen, agents and
					participant emails, in every language. Test interviews keep using the draft.
				</p>
			</div>

			<div class="flex flex-col gap-4 overflow-y-auto px-6 pb-4">
				{#if !status.has_unpublished_changes}
					<p class="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
						Respondents already see the current draft; there is nothing to publish.
					</p>
				{:else if blocked}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
						<p class="font-medium">Translate everything before publishing.</p>
						<ul class="mt-1 list-disc pl-5">
							{#each missing as [code, paths] (code)}
								<li>
									{languageName(code)}: {paths?.length ?? 0} untranslated
									{(paths?.length ?? 0) === 1 ? 'text' : 'texts'}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if status.languages_in_progress.length && status.has_unpublished_changes}
					<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
						<i class="fa-solid fa-person-digging mr-1"></i>
						Left out, still in progress:
						{status.languages_in_progress.map(languageName).join(', ')}. Respondents are not offered {status
							.languages_in_progress.length === 1
							? 'it'
							: 'them'} until marked ready in the language menu.
					</p>
				{/if}

				{#if status.published && status.has_unpublished_changes}
					<fieldset class="flex flex-col gap-2">
						<legend class="mb-1 text-sm font-medium text-gray-700">Kind of change</legend>
						{#each choices as choice (choice)}
							<label class="flex cursor-pointer items-start gap-2 text-sm">
								<input type="radio" class="mt-1" bind:group={bump} value={choice} />
								<span>
									<span class="font-medium text-gray-900 capitalize">{choice}</span>
									{#if choice === pending}
										<span class="text-xs text-gray-500">(from what changed)</span>
									{/if}
									<span class="block text-gray-500">{BUMP_MEANING[choice]}</span>
								</span>
							</label>
						{/each}
						<p class="text-xs text-gray-500">
							The kind is worked out from what changed. Raise it if a rewording changes what a
							question means.
						</p>
					</fieldset>
				{/if}

				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-gray-700">Note (optional)</span>
					<input
						type="text"
						class="rounded border border-gray-300 px-3 py-2"
						maxlength="200"
						placeholder="What changed, for the history"
						bind:value={label}
					/>
				</label>
			</div>

			<div class="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
				<button
					type="button"
					class="rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
					onclick={() => (dialogOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-dark disabled:opacity-50"
					onclick={publish}
					disabled={publishing || blocked || !status.has_unpublished_changes}
				>
					{publishing ? 'Publishing…' : `Publish ${target}`}
				</button>
			</div>
		</div>
	</div>
{/if}

<VersionHistory bind:open={historyOpen} {projectId} {lang} {availableLanguages} />
