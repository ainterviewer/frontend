<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Default, Versions } from '$lib/api';
	import type {
		ContentError,
		ContentStatus,
		ModelOption,
		ProjectLanguage
	} from '$lib/api/types.gen';
	import { type LivePart, sessionErrors } from '$lib/collab/contentSession.svelte';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import ModelPicker from '$lib/components/ModelPicker.svelte';
	import { hasErrorCode } from '$lib/utils/errors';
	import { portal } from '$lib/utils/portal';
	import { toastApiError } from '$lib/utils/toast';

	import { fixFirst, invalidParts, WOULD } from './invalidParts';
	import { SPEECH, testOnlyUseLabel } from './models';
	import { contentRevision, saveWithRevision } from './revision.svelte';
	import { allowedBumps, type Bump, BUMP_MEANING, maxBump, nextVersion } from './semver';
	import VersionCompare from './VersionCompare.svelte';
	import VersionHistory from './VersionHistory.svelte';

	let {
		projectId,
		lang,
		availableLanguages = [],
		onBeforePublish,
		primary = false,
		live,
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
		/** The part the page edits live, with its current errors: they win over
		 * the status's, which are as last saved. */
		live?: { part: LivePart; errors: ContentError[] };
		/** Drawn right before the Publish button, after the history; given the
		 * parts that are invalid, which no test may run while they are. */
		beside?: Snippet<[LivePart[]]>;
	} = $props();

	// The project layout's load hands the status over (`loadContentStatus`), so
	// the bar draws it from the first paint, and its own fetch below follows.
	let status = $state<ContentStatus | null>(
		(page.data.contentStatus as ContentStatus | null | undefined) ?? null
	);
	let dialogOpen = $state(false);
	let historyOpen = $state(false);
	let comparing = $state(false);
	let publishing = $state(false);
	// The backend refuses demo accounts a publish; saving and restoring
	// versions stay open to them.
	const isDemo = $derived(page.data.user?.scope === 'demo');
	let label = $state('');
	let bump = $state<Bump>('patch');
	// The model the agents on test-only ones move to as part of the publish,
	// chosen in the dialog; '' until the researcher picks one.
	let switchTo = $state('');
	let models = $state<ModelOption[]>([]);

	// The status's `ETag` is the whole content's revision, which publishing
	// writes against: publishing anything changed after the dialog showed it
	// would release work nobody reviewed. The parts' revisions, which the
	// editors write against, are theirs alone.
	async function loadStatus() {
		const { data, response } = await Versions.getContentStatus({
			path: { project_id: projectId }
		});
		status = data ?? null;
		contentRevision.take(projectId, 'content', response);
	}

	// Again whenever anything here saves: the badge follows the draft.
	$effect(() => {
		void contentRevision.changes;
		void projectId;
		loadStatus();
	});

	const missing = $derived(Object.entries(status?.missing ?? {}));
	// The sidebar works them out alike, short of the page's own errors.
	const invalid = $derived(
		invalidParts(status, {
			...sessionErrors(projectId),
			...(live && { [live.part]: live.errors })
		})
	);
	// The backend refuses it too; disabled, the button says why up front.
	const publishBlocked = $derived(fixFirst(invalid, WOULD.publish));
	// Why Publish is off, if it is for a reason the user should hear.
	const publishRefused = $derived(
		isDemo ? 'You cannot publish with your current demo access.' : publishBlocked
	);
	// What the draft would send respondents' answers to that is for test
	// interviews only (app/distribution.py), and the same for what is live:
	// then no distributed interview can start on it. Agents can be switched
	// to another model as part of the publish; speech cannot.
	const testOnly = $derived(Object.entries(status?.test_only ?? {}));
	const agentTestOnly = $derived(testOnly.filter(([key]) => key !== SPEECH));
	const speechTestOnly = $derived(testOnly.some(([key]) => key === SPEECH));
	const liveTestOnly = $derived(Object.keys(status?.published_test_only ?? {}));
	const switching = $derived(!!switchTo && agentTestOnly.length > 0);
	const allowedModels = $derived(models.filter((m) => !m.test_only));
	const blocked = $derived(
		missing.length > 0 || speechTestOnly || (agentTestOnly.length > 0 && !switching)
	);
	// Switching models changes the draft even when it was what is published.
	const publishable = $derived(!!status?.has_unpublished_changes || switching);

	const pending = $derived<Bump>(status?.pending_bump ?? 'major');
	// A model change is a settings change, so at least minor: the server
	// refuses a bump lower than the switched draft needs.
	const floor = $derived<Bump>(
		switching ? maxBump(pending, 'minor') : pending === 'none' ? 'patch' : pending
	);
	const choices = $derived(allowedBumps(floor));
	const target = $derived(nextVersion(status?.next_semver ?? '1.0.0', pending, bump));
	$effect(() => {
		if (!choices.includes(bump)) bump = floor;
	});
	const agentsHref = $derived(
		resolve('/dashboard/projects/[project_id]/[lang]/agents', { project_id: projectId, lang })
	);
	const setupHref = $derived(
		resolve('/dashboard/projects/[project_id]/[lang]/setup', { project_id: projectId, lang })
	);

	function languageName(code: string) {
		return availableLanguages.find((l) => l.code === code)?.name ?? code;
	}

	async function openDialog() {
		// Save first: the dialog describes the saved draft.
		if (onBeforePublish && (await onBeforePublish()) === false) return;
		await loadStatus();
		bump = pending === 'none' ? 'patch' : pending;
		label = '';
		switchTo = '';
		dialogOpen = true;
		if (agentTestOnly.length && !models.length) {
			const { data } = await Default.getModels();
			models = data ?? [];
		}
	}

	async function publish() {
		publishing = true;
		const result = await saveWithRevision(projectId, 'content', 'the publish dialog', (headers) =>
			Versions.saveContentVersion({
				path: { project_id: projectId },
				body: {
					publish: true,
					label: label.trim() || null,
					bump,
					switch_models_to: switching ? switchTo : null
				},
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
		// The switch rewrote the draft's agents: pages showing them reload.
		if (switching) await invalidateAll();
		await loadStatus();
	}

	function handleKeydown(e: KeyboardEvent) {
		// The comparison closes itself on Escape.
		if (e.key === 'Escape' && !comparing) dialogOpen = false;
	}
</script>

<svelte:window onkeydown={dialogOpen ? handleKeydown : undefined} />

{#snippet refused()}
	<span class="flex gap-2">
		<i class="fas fa-triangle-exclamation mt-0.5 text-red-500" aria-hidden="true"></i>
		<span>{publishRefused}</span>
	</span>
{/snippet}

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
		{#if liveTestOnly.length}
			<span
				class="h-2 w-2 rounded-full bg-red-500"
				title="Closed to respondents: the published version uses {liveTestOnly
					.map(testOnlyUseLabel)
					.join(', ')} for test interviews only"
			></span>
		{/if}
		{#if status?.has_unpublished_changes}
			<span
				class="h-2 w-2 rounded-full bg-amber-500"
				title="The draft has changes respondents do not see yet"
			></span>
		{/if}
	</button>
	{@render beside?.(invalid)}
	<!-- Blocked, it is aria-disabled rather than disabled: a disabled button
	     gets no hover or focus, so it could not say why it is off. -->
	<HoverInfo asChild content={publishRefused ? refused : undefined}>
		{#snippet children({ props })}
			<button
				{...props}
				data-tour="publish"
				type="button"
				class={[
					'flex items-center gap-2 rounded-full border border-primary px-4 py-2 font-medium whitespace-nowrap disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 @3xl:px-6',
					primary
						? 'bg-primary text-white shadow-sm not-aria-disabled:hover:bg-dark'
						: 'text-primary not-aria-disabled:hover:bg-primary/10'
				]}
				onclick={() => {
					if (!publishRefused) openDialog();
				}}
				disabled={publishing}
				aria-disabled={!!publishRefused}
				title={publishRefused ? undefined : 'Publish the draft to respondents'}
				aria-label={publishRefused ? `Publish: ${publishRefused}` : 'Publish'}
			>
				<i class="fa-solid fa-upload"></i>
				<span class="hidden @3xl:inline">Publish</span>
			</button>
		{/snippet}
	</HoverInfo>
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
				{#if !publishable && !agentTestOnly.length}
					<p class="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
						Respondents already see the current draft; there is nothing to publish.
					</p>
				{:else if missing.length}
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

				{#if liveTestOnly.length}
					<p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
						<i class="fa-solid fa-ban mr-1"></i>
						Closed to respondents: the published version uses
						{liveTestOnly.map(testOnlyUseLabel).join(', ')} for test interviews only, so new interviews
						are refused until a version without {liveTestOnly.length === 1 ? 'it' : 'them'} is published.
					</p>
				{/if}
				{#if testOnly.length}
					<div
						class={[
							'rounded-lg border p-3 text-sm',
							switching && !speechTestOnly
								? 'border-amber-200 bg-amber-50 text-amber-900'
								: 'border-red-200 bg-red-50 text-red-800'
						]}
					>
						<p class="font-medium">
							{#if switching && !speechTestOnly}
								Publishing switches these to {switchTo}, in the draft too:
							{:else}
								Respondents' answers may not be sent to models for test interviews only.
							{/if}
						</p>
						<ul class="mt-1 list-disc pl-5">
							{#each testOnly as [key, model] (key)}
								<li>
									{testOnlyUseLabel(key)}: {model}
									{#if key === SPEECH}
										&mdash; <a class="underline" href={setupHref}>turn off audio answers</a>
									{/if}
								</li>
							{/each}
						</ul>
						{#if agentTestOnly.length}
							{#if allowedModels.length}
								<div class="mt-3 flex flex-col gap-1">
									<span class="font-medium">
										Switch {agentTestOnly.length === 1 ? 'it' : 'them'} to
									</span>
									<ModelPicker
										models={allowedModels}
										bind:value={switchTo}
										label="Model for respondents"
									/>
								</div>
								{#if switching}
									<p class="mt-2 text-xs">
										Your test interviews ran on the models above. Respondents will be interviewed by {switchTo},
										which may probe differently; consider a simulation on it first.
									</p>
								{/if}
							{:else}
								<a class="mt-1 inline-block underline" href={agentsHref}>Choose other models</a>
							{/if}
						{/if}
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

				{#if status.published && publishable}
					<button
						type="button"
						class="self-start text-sm text-primary hover:underline"
						onclick={() => (comparing = true)}
					>
						<i class="fa-solid fa-code-compare mr-1"></i>
						Review what changed since v{status.published.semver}
					</button>

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
					disabled={publishing || blocked || !publishable}
				>
					{publishing
						? 'Publishing…'
						: switching
							? `Switch and publish ${target}`
							: `Publish ${target}`}
				</button>
			</div>
		</div>
	</div>
{/if}

<VersionHistory
	bind:open={historyOpen}
	{projectId}
	{lang}
	{availableLanguages}
	published={status?.published}
/>

{#if comparing && status?.published}
	<VersionCompare
		versionId={status.published.id}
		{projectId}
		{lang}
		{availableLanguages}
		onClose={() => (comparing = false)}
	/>
{/if}
