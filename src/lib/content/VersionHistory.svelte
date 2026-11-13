<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { Versions } from '$lib/api';
	import type {
		ContentVersionPublic,
		ContentVersionSummaryPublic,
		ProjectLanguage
	} from '$lib/api/types.gen';
	import { hasErrorCode } from '$lib/utils/errors';
	import { portal } from '$lib/utils/portal';
	import { toastApiError } from '$lib/utils/toast';

	import { KIND_LABEL, KIND_PILL } from './labels';
	import { contentRevision, saveWithRevision } from './revision.svelte';
	import VersionCompare from './VersionCompare.svelte';
	import VersionPreview from './VersionPreview.svelte';

	let {
		open = $bindable(),
		projectId,
		lang,
		availableLanguages = [],
		published = null
	}: {
		open: boolean;
		projectId: string;
		lang: string;
		availableLanguages?: ProjectLanguage[];
		/** What respondents get, for comparing the draft with it. */
		published?: ContentVersionSummaryPublic | null;
	} = $props();

	const PAGE = 20;

	let versions = $state<ContentVersionSummaryPublic[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let saving = $state(false);
	let label = $state('');
	let preview = $state<ContentVersionPublic | null>(null);
	/** The version being compared with the draft. */
	let comparing = $state<string | null>(null);

	async function load(offset = 0) {
		loading = true;
		const { data, error } = await Versions.listContentVersions({
			path: { project_id: projectId },
			query: { limit: PAGE, offset }
		});
		loading = false;
		if (error || !data) {
			toastApiError(error, 'Failed to load the history');
			return;
		}
		versions = offset === 0 ? data.items : [...versions, ...data.items];
		total = data.total;
	}

	async function saveVersion() {
		saving = true;
		const result = await saveWithRevision(projectId, 'content', 'the history', (headers) =>
			Versions.saveContentVersion({
				path: { project_id: projectId },
				body: { publish: false, label: label.trim() || null },
				headers
			})
		);
		saving = false;
		if (hasErrorCode(result.error, 'stale_revision')) return;
		if (result.error) {
			toastApiError(result.error, 'Failed to save the version');
			return;
		}
		label = '';
		toast.success('Version saved');
		await load();
	}

	async function showPreview(version: ContentVersionSummaryPublic) {
		const { data, error } = await Versions.getContentVersion({
			path: { project_id: projectId, version_id: version.id }
		});
		if (error || !data) {
			toastApiError(error, 'Failed to load the version');
			return;
		}
		preview = data;
	}

	async function restore(version: ContentVersionSummaryPublic) {
		const name = version.semver ? `version ${version.semver}` : `snapshot #${version.version_no}`;
		if (
			!confirm(
				`Replace the draft with ${name}? Unsaved edits on this page are lost. The current draft is kept in the history, and nothing is published.`
			)
		) {
			return;
		}
		const result = await saveWithRevision(projectId, 'content', 'the history', (headers) =>
			Versions.restoreContentVersion({
				path: { project_id: projectId, version_id: version.id },
				headers
			})
		);
		if (hasErrorCode(result.error, 'stale_revision')) return;
		if (result.error) {
			toastApiError(result.error, 'Failed to restore');
			return;
		}
		// Every editor page holds its own copy of the draft, loaded once.
		location.reload();
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		// The preview and the comparison close themselves on Escape.
		if (e.key === 'Escape' && !preview && !comparing) open = false;
	}

	// On opening, and again when a save here moves the draft: the list may
	// have grown.
	$effect(() => {
		void contentRevision.changes;
		if (open) load();
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- Portalled, like everything opened from the action bar: its
	     backdrop-filter would clip a fixed overlay to the bar. Starts below
	     the app header (fixed, h-11), which stays usable. -->
	<div
		use:portal
		class="fixed inset-x-0 top-11 bottom-0 z-50 flex justify-end bg-slate-900/40"
		role="dialog"
		aria-modal="true"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close history"
			onclick={() => (open = false)}
			tabindex="-1"
		></button>

		<aside class="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
				<h3 class="text-base font-semibold text-gray-900">Version history</h3>
				<button
					type="button"
					class="rounded-full p-2 text-gray-500 hover:bg-gray-100"
					onclick={() => (open = false)}
					aria-label="Close"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<form
				class="flex gap-2 border-b border-gray-100 px-5 py-3"
				onsubmit={(e) => {
					e.preventDefault();
					saveVersion();
				}}
			>
				<input
					type="text"
					class="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
					maxlength="200"
					placeholder="Name this draft, to come back to"
					bind:value={label}
				/>
				<button
					type="submit"
					class="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
					disabled={saving}
				>
					Save version
				</button>
			</form>

			{#if published && !published.matches_draft}
				<button
					type="button"
					class="flex items-center gap-2 border-b border-gray-100 px-5 py-2.5 text-left text-sm text-primary hover:bg-gray-50"
					onclick={() => (comparing = published.id)}
				>
					<i class="fa-solid fa-code-compare"></i>
					See what changed since the live version, v{published.semver}
				</button>
			{/if}

			<ul class="flex-1 divide-y divide-gray-100 overflow-y-auto">
				{#each versions as version (version.id)}
					<li class="flex flex-col gap-1 px-5 py-3">
						<div class="flex items-center gap-2">
							<span class="font-mono text-sm font-semibold text-gray-900">
								{version.semver ? `v${version.semver}` : `#${version.version_no}`}
							</span>
							<span class="rounded {KIND_PILL[version.kind]} px-1.5 py-0.5 text-xs">
								{KIND_LABEL[version.kind]}
							</span>
							{#if version.is_published}
								<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
									Live
								</span>
							{/if}
						</div>
						{#if version.label}
							<p class="text-sm text-gray-700">{version.label}</p>
						{/if}
						<p class="text-xs text-gray-500">
							{formatDate(version.created_at)}{version.created_by_name
								? ` · ${version.created_by_name}`
								: ''}
						</p>
						<div class="mt-1 flex gap-3 text-sm">
							<button
								type="button"
								class="text-primary hover:underline"
								onclick={() => showPreview(version)}
							>
								Preview
							</button>
							{#if version.matches_draft}
								<span
									class="ml-auto text-gray-500"
									title="Holds the same content as the draft, so comparing or restoring it would change nothing."
								>
									<i class="fa-solid fa-equals mr-0.5 text-xs"></i>
									Same as draft
								</span>
							{:else}
								<button
									type="button"
									class="text-primary hover:underline"
									onclick={() => (comparing = version.id)}
								>
									Compare with draft
								</button>
								<button
									type="button"
									class="ml-auto text-gray-500 hover:text-gray-800 hover:underline"
									onclick={() => restore(version)}
								>
									<i class="fa-solid fa-rotate-left mr-0.5 text-xs"></i>
									Restore to draft
								</button>
							{/if}
						</div>
					</li>
				{:else}
					{#if !loading}
						<li class="px-5 py-6 text-sm text-gray-500">Nothing published or saved yet.</li>
					{/if}
				{/each}
			</ul>

			{#if versions.length < total}
				<button
					type="button"
					class="border-t border-gray-100 px-5 py-3 text-sm text-primary hover:bg-gray-50"
					onclick={() => load(versions.length)}
					disabled={loading}
				>
					Load older versions
				</button>
			{/if}
		</aside>
	</div>
{/if}

{#if preview}
	<VersionPreview
		version={preview}
		{projectId}
		{lang}
		{availableLanguages}
		onClose={() => (preview = null)}
	/>
{/if}

{#if comparing}
	<VersionCompare
		versionId={comparing}
		{projectId}
		{lang}
		{availableLanguages}
		onClose={() => (comparing = null)}
	/>
{/if}
