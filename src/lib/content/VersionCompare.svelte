<script lang="ts">
	import { diffWordsWithSpace } from 'diff';
	import { onMount } from 'svelte';

	import { Versions } from '$lib/api';
	import type {
		ContentDraftPublic,
		ContentVersionPublic,
		ProjectLanguage
	} from '$lib/api/types.gen';
	import { portal } from '$lib/utils/portal';
	import { toastApiError } from '$lib/utils/toast';

	import {
		type Change,
		diffContent,
		guideChangeCount,
		isChanged,
		plainText,
		type QuestionDiff,
		type Status
	} from './diff';
	import { KIND_LABEL } from './labels';

	let {
		versionId,
		projectId,
		lang,
		availableLanguages = [],
		onClose
	}: {
		/** The version compared against the draft. */
		versionId: string;
		projectId: string;
		/** The page's language, shown first when either side offers it. */
		lang: string;
		/** For language names; codes are shown for any it does not list. */
		availableLanguages?: ProjectLanguage[];
		onClose: () => void;
	} = $props();

	type Tab = 'guide' | 'consent' | 'welcome' | 'emails' | 'settings';

	let version = $state<ContentVersionPublic | null>(null);
	let draft = $state<ContentDraftPublic | null>(null);
	let chosenLanguage = $state<string | null>(null);
	let tab = $state<Tab>('guide');
	let showUnchanged = $state(false);

	const languages = $derived(
		version && draft ? [...new Set([...draft.languages, ...version.languages])] : []
	);
	const language = $derived(
		chosenLanguage ?? (languages.includes(lang) ? lang : (draft?.default_language ?? lang))
	);
	const diff = $derived(version && draft ? diffContent(version, draft, language) : null);

	const tabs = $derived.by((): [Tab, string, number][] => {
		if (!diff) return [];
		const count = (changes: Change[]) => changes.filter(isChanged).length;
		return [
			['guide', 'Guide', guideChangeCount(diff)],
			['consent', 'Consent', count(diff.consent)],
			['welcome', 'Welcome', count(diff.welcome)],
			['emails', 'Emails', count(diff.emails)],
			['settings', 'Languages & agents', count(diff.languages) + count(diff.agents)]
		];
	});
	const total = $derived(tabs.reduce((n, [, , c]) => n + c, 0));

	// Framing and introduction come before the sections, the rest after.
	const TOP = new Set(['framing', 'introduction']);
	const guideTop = $derived(diff?.guide.filter((c) => TOP.has(c.key)) ?? []);
	const guideBottom = $derived(diff?.guide.filter((c) => !TOP.has(c.key)) ?? []);
	const sections = $derived(
		diff?.sections.filter((s) => showUnchanged || isChanged(s) || s.questions.some(isChanged)) ?? []
	);

	const STATUS_BADGE: Record<Exclude<Status, 'same'>, [string, string]> = {
		added: ['New', 'bg-green-100 text-green-800'],
		removed: ['Removed', 'bg-red-100 text-red-800'],
		changed: ['Changed', 'bg-amber-100 text-amber-800']
	};

	async function load() {
		const [v, d] = await Promise.all([
			Versions.getContentVersion({ path: { project_id: projectId, version_id: versionId } }),
			Versions.getContentDraft({ path: { project_id: projectId } })
		]);
		if (v.error || !v.data || d.error || !d.data) {
			toastApiError(v.error ?? d.error, 'Failed to load the versions to compare');
			onClose();
			return;
		}
		version = v.data;
		draft = d.data;
	}

	onMount(() => {
		load();
	});

	function visible(changes: Change[]) {
		return showUnchanged ? changes : changes.filter(isChanged);
	}

	/**
	 * What to list of a section or question that was added or removed: its
	 * text and survey, not every setting it has at its default.
	 */
	function shown(status: Status, changes: Change[]) {
		const all = visible(changes);
		if (status !== 'added' && status !== 'removed') return all;
		return all.filter((c) => c.prose || c.key.startsWith('survey_item'));
	}

	function languageName(code: string) {
		return availableLanguages.find((l) => l.code === code)?.name ?? code;
	}

	function versionName(v: ContentVersionPublic) {
		return v.semver ? `v${v.semver}` : `#${v.version_no}`;
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}

	/** Each question's number on the side it is on: removed ones have none. */
	function numbers(questions: QuestionDiff[]) {
		let n = 0;
		return questions.map((q) => (q.status === 'removed' ? null : ++n));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet badge(status: Status, moved = false, fromSection: number | null = null)}
	{#if status !== 'same'}
		{@const [text, cls] = STATUS_BADGE[status]}
		<span class="rounded px-1.5 py-0.5 text-[11px] font-medium {cls}">{text}</span>
	{/if}
	{#if moved}
		<span class="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-800">
			<i class="fa-solid fa-arrows-up-down"></i>
			{fromSection ? `Moved from section ${fromSection}` : 'Moved'}
		</span>
	{/if}
{/snippet}

{#snippet value(c: Change)}
	{#if c.opaque}
		<span class="text-gray-600 italic">
			{c.status === 'added' ? 'Added' : c.status === 'removed' ? 'Removed' : 'Changed'}
		</span>
	{:else if c.prose}
		{@const before = plainText(c.before ?? '')}
		{@const after = plainText(c.after ?? '')}
		{#if c.status !== 'same' && before === after}
			<span class="whitespace-pre-wrap">{after}</span>
			<span class="ml-1 text-xs text-gray-500 italic">(formatting changed)</span>
		{:else}
			<span class="whitespace-pre-wrap"
				>{#each diffWordsWithSpace(before, after) as part, i (i)}{#if part.added}<ins
							class="rounded-sm bg-green-100 text-green-900 no-underline">{part.value}</ins
						>{:else if part.removed}<del class="rounded-sm bg-red-100 text-red-800"
							>{part.value}</del
						>{:else}{part.value}{/if}{/each}</span
			>
		{/if}
	{:else if c.status === 'same'}
		{c.after}
	{:else}
		{#if c.before !== null}<del class="rounded-sm bg-red-100 px-0.5 text-red-800">{c.before}</del
			>{/if}{#if c.before !== null && c.after !== null}<i
				class="fa-solid fa-arrow-right mx-1.5 text-[10px] text-gray-400"
			></i>{/if}{#if c.after !== null}<ins
				class="rounded-sm bg-green-100 px-0.5 text-green-900 no-underline">{c.after}</ins
			>{/if}
	{/if}
{/snippet}

{#snippet changeList(changes: Change[])}
	{#if changes.length}
		<dl class="flex flex-col gap-2 text-sm">
			{#each changes as c (c.key)}
				<div class={[c.status === 'same' && 'text-gray-500']}>
					<dt class="flex items-center gap-2 text-xs font-medium text-gray-500">
						{c.label}
						{#if c.status === 'added' || c.status === 'removed'}
							{@render badge(c.status)}
						{/if}
					</dt>
					<dd class="mt-0.5 text-gray-800">{@render value(c)}</dd>
				</div>
			{/each}
		</dl>
	{/if}
{/snippet}

{#snippet card(title: string, changes: Change[])}
	{@const shown = visible(changes)}
	{#if shown.length}
		<section class="rounded-lg border border-gray-200 bg-white p-4">
			{#if title}
				<h4 class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">{title}</h4>
			{/if}
			{@render changeList(shown)}
		</section>
	{/if}
{/snippet}

{#snippet nothing()}
	<p class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
		No changes here.
	</p>
{/snippet}

<div
	use:portal
	class="fixed inset-0 z-1100 flex items-center justify-center bg-slate-900/60 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="version-compare-title"
>
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		aria-label="Close comparison"
		onclick={onClose}
		tabindex="-1"
	></button>

	<div
		class="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-gray-50 shadow-2xl"
	>
		<!-- Header -->
		<div class="border-b border-gray-200 bg-white px-6 pt-4">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<h3
						id="version-compare-title"
						class="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900"
					>
						{#if version}
							<span class="font-mono">{versionName(version)}</span>
							<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">
								{KIND_LABEL[version.kind]}
							</span>
							{#if version.is_published}
								<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
									Live
								</span>
							{/if}
							<i class="fa-solid fa-arrow-right text-xs text-gray-400"></i>
							<span>Current draft</span>
						{:else}
							Comparing…
						{/if}
					</h3>
					{#if version}
						<p class="mt-0.5 text-xs text-gray-500">
							{formatDate(version.created_at)}{version.created_by_name
								? ` · ${version.created_by_name}`
								: ''}{version.label ? ` · ${version.label}` : ''} · {total === 0
								? 'no changes'
								: `${total} ${total === 1 ? 'change' : 'changes'}`}
						</p>
					{/if}
				</div>
				<button
					type="button"
					class="rounded-full p-2 text-gray-500 hover:bg-gray-100"
					onclick={onClose}
					aria-label="Close"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="mt-3 flex flex-wrap items-end justify-between gap-2">
				<div class="flex flex-wrap gap-1" role="tablist">
					{#each tabs as [id, label, count] (id)}
						<button
							type="button"
							role="tab"
							aria-selected={tab === id}
							class="border-b-2 px-3 py-2 text-sm font-medium {tab === id
								? 'border-primary text-primary'
								: 'border-transparent text-gray-500 hover:text-gray-800'}"
							onclick={() => (tab = id)}
						>
							{label}
							{#if count}
								<span
									class="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 tabular-nums"
									>{count}</span
								>
							{/if}
						</button>
					{/each}
				</div>
				<div class="mb-1.5 flex flex-wrap items-center gap-3">
					<label class="flex items-center gap-1.5 text-xs text-gray-600">
						<input type="checkbox" bind:checked={showUnchanged} />
						Show unchanged
					</label>
					{#if languages.length > 1}
						<div class="flex gap-1">
							{#each languages as code (code)}
								<button
									type="button"
									class="rounded-full px-2.5 py-1 text-xs font-medium {language === code
										? 'bg-primary text-white'
										: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
									onclick={() => (chosenLanguage = code)}
									title={languageName(code)}
								>
									{code}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Body -->
		<div class="flex flex-col gap-3 overflow-y-auto px-6 py-4">
			{#if !diff}
				<p class="py-10 text-center text-sm text-gray-500">
					<i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading…
				</p>
			{:else if tab === 'guide'}
				{#if guideChangeCount(diff) === 0 && !showUnchanged}
					{@render nothing()}
				{/if}
				{#each guideTop as c (c.key)}
					{@render card('', [c])}
				{/each}

				{#each sections as section (section.id)}
					{@const nums = numbers(section.questions)}
					{@const hidden = section.questions.filter((q) => !isChanged(q)).length}
					<section
						class={[
							'rounded-lg border bg-white',
							section.status === 'removed' ? 'border-red-200 opacity-80' : 'border-gray-200'
						]}
					>
						<div class="border-b border-gray-100 px-4 py-3">
							<div class="flex flex-wrap items-center gap-2">
								<h4 class="text-sm font-semibold text-gray-900">Section {section.number}</h4>
								{@render badge(section.status, section.moved)}
							</div>
							{#if shown(section.status, section.changes).length}
								<div class="mt-2">
									{@render changeList(shown(section.status, section.changes))}
								</div>
							{/if}
						</div>
						<ol class="divide-y divide-gray-100">
							{#each section.questions as question, i (question.id)}
								{#if showUnchanged || isChanged(question)}
									{@const main = question.changes.find((c) => c.key === 'main_question')}
									{@const rest = shown(
										question.status,
										question.changes.filter((c) => c !== main)
									)}
									<li
										class={[
											'flex gap-3 px-4 py-3',
											question.status === 'removed' && 'bg-red-50/40',
											question.status === 'added' && 'bg-green-50/40'
										]}
									>
										<span
											class="w-8 shrink-0 pt-0.5 text-xs font-medium text-gray-400 tabular-nums"
										>
											{nums[i] === null ? '–' : `${section.number}.${nums[i]}`}
										</span>
										<div class="flex min-w-0 flex-1 flex-col gap-2">
											<div class="flex flex-wrap items-start gap-2">
												<p
													class={[
														'min-w-0 flex-1 text-sm',
														question.status === 'same' ? 'text-gray-500' : 'text-gray-900'
													]}
												>
													{#if main}{@render value(main)}{:else}<span class="text-gray-400 italic"
															>No question text</span
														>{/if}
												</p>
												<span class="flex shrink-0 gap-1">
													{@render badge(question.status, question.moved, question.fromSection)}
												</span>
											</div>
											{#if rest.length}
												<div class="rounded border border-gray-100 bg-gray-50 px-3 py-2">
													{@render changeList(rest)}
												</div>
											{/if}
										</div>
									</li>
								{/if}
							{/each}
							{#if hidden && !showUnchanged}
								<li class="px-4 py-2 text-xs text-gray-400">
									{hidden} unchanged {hidden === 1 ? 'question' : 'questions'}
								</li>
							{/if}
						</ol>
					</section>
				{/each}

				{#each guideBottom as c (c.key)}
					{#if showUnchanged || isChanged(c)}
						{@render card('', [c])}
					{/if}
				{/each}
			{:else if tab === 'consent'}
				{#if !visible(diff.consent).length}{@render nothing()}{/if}
				{@render card('', diff.consent)}
			{:else if tab === 'welcome'}
				{#if !visible(diff.welcome).length}{@render nothing()}{/if}
				{@render card('', diff.welcome)}
			{:else if tab === 'emails'}
				{#if !visible(diff.emails).length}{@render nothing()}{/if}
				{@render card('', diff.emails)}
			{:else if tab === 'settings'}
				{#if !visible(diff.languages).length && !visible(diff.agents).length}
					{@render nothing()}
				{/if}
				{@render card('Languages', diff.languages)}
				{@render card('Agents', diff.agents)}
			{/if}
		</div>
	</div>
</div>
