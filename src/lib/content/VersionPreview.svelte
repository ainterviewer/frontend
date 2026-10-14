<script lang="ts">
	import type {
		ContentVersionKind,
		ContentVersionPublic,
		LocalizedQuestion,
		LocalizedText,
		ProjectLanguage
	} from '$lib/api/types.gen';
	import ConsentPreview from '$lib/components/preview/ConsentPreview.svelte';
	import EmailPreview from '$lib/components/preview/EmailPreview.svelte';
	import WelcomePreview from '$lib/components/preview/WelcomePreview.svelte';
	import { portal } from '$lib/utils/portal';
	import { sanitizeMarkup } from '$lib/utils/sanitize';

	let {
		version,
		projectId,
		lang,
		availableLanguages = [],
		onClose
	}: {
		version: ContentVersionPublic;
		projectId: string;
		/** The page's language, shown first when the version offers it. */
		lang: string;
		/** For language names; codes are shown for any it does not list. */
		availableLanguages?: ProjectLanguage[];
		onClose: () => void;
	} = $props();

	type Tab = 'guide' | 'consent' | 'welcome' | 'emails' | 'agents';

	// svelte-ignore state_referenced_locally
	let language = $state(version.languages.includes(lang) ? lang : version.default_language);
	let tab = $state<Tab>('guide');

	const guide = $derived(version.guide);
	const sections = $derived(guide.question_sections ?? []);
	const tabs = $derived(
		(
			[
				['guide', 'Guide', true],
				['consent', 'Consent', !!version.consent],
				['welcome', 'Welcome', !!version.welcome],
				['emails', 'Emails', true],
				['agents', 'Agents', true]
			] as [Tab, string, boolean][]
		).filter(([, , shown]) => shown)
	);

	const KIND_LABEL: Record<ContentVersionKind, string> = {
		publish: 'Published',
		manual: 'Saved',
		test: 'Tested',
		restore: 'Before a restore',
		auto: 'Autosave'
	};

	const SURVEY_LABEL: Record<string, string> = {
		radio: 'Single choice',
		checkbox: 'Multiple choice',
		likert: 'Likert scale',
		slider: 'Slider',
		number: 'Number',
		date: 'Date',
		datetime: 'Date and time',
		time: 'Time'
	};

	const AGENT_LABEL: Record<string, string> = {
		probing: 'Probing',
		classification: 'Classification',
		guide: 'Guide',
		history: 'History',
		security: 'Security',
		answering: 'Answering',
		reformulation: 'Reformulation',
		visual: 'Visual'
	};

	// Model and temperature per agent, in the order the agents page lists them.
	const agents = $derived(
		Object.entries(version.agent_configs ?? {})
			.filter(([, config]) => config)
			.map(([name, config]) => {
				const c = config as { model?: string; temperature?: number; include?: boolean };
				return { name, model: c.model, temperature: c.temperature, include: c.include };
			})
	);
	const probing = $derived(version.agent_configs?.probing);
	// Only the slots set on the project: null means "the default prompt".
	const customSlots = $derived(
		(
			[
				['Persona', probing?.prompt_slots?.persona],
				['Question qualities', probing?.prompt_slots?.question_qualities],
				['Additional guidelines', probing?.prompt_slots?.guidelines],
				['Probing instructions', probing?.prompt_slots?.instructions],
				['Few-shot examples', probing?.few_shot_examples]
			] as [string, string | string[] | null | undefined][]
		).filter(([, value]) => value != null && value.length > 0)
	);
	const overriddenTemplates = $derived(Object.keys(version.prompt_overrides ?? {}));

	function inProgress(code: string) {
		return version.languages_in_progress.includes(code);
	}

	function languageName(code: string) {
		return availableLanguages.find((l) => l.code === code)?.name ?? code;
	}

	/**
	 * The text in the chosen language; `fallback` when it is borrowed from
	 * the default language because this one has none, which is what
	 * respondents in it would get.
	 */
	function read(text: LocalizedText | null | undefined): { value: string; fallback: boolean } {
		const own = text?.[language];
		if (own) return { value: own, fallback: false };
		const borrowed = text?.[version.default_language] ?? '';
		return { value: borrowed, fallback: language !== version.default_language && !!borrowed };
	}

	function hasText(text: LocalizedText | null | undefined) {
		return !!read(text).value.trim();
	}

	function options(q: LocalizedQuestion) {
		const item = q.survey_item;
		return item && 'options' in item ? item.options : [];
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet text(value: LocalizedText | null | undefined, cls = '')}
	{@const t = read(value)}
	<!-- Guide text is authored markup, reduced to an inline allowlist by
	     sanitizeMarkup, as in the chat and the report. Block-scoped: the
	     line-scoped directive does not survive the formatter here. -->
	<!-- eslint-disable svelte/no-at-html-tags -->
	<span class={['whitespace-pre-wrap', cls, { 'text-gray-500': t.fallback }]}
		>{@html sanitizeMarkup(t.value)}</span
	>{#if t.fallback && t.value}<span
			class="ml-1.5 rounded bg-amber-50 px-1 py-0.5 align-middle text-[10px] font-medium text-amber-700"
			title="Not translated: respondents get the {languageName(version.default_language)} text"
			>untranslated</span
		>{/if}
{/snippet}

{#snippet untranslatedNote(texts: (LocalizedText | null | undefined)[])}
	{#if texts.some((t) => read(t).fallback)}
		<p class="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
			Not translated into {languageName(language)}: shown, as respondents get it, in
			{languageName(version.default_language)}.
		</p>
	{/if}
{/snippet}

{#snippet block(title: string, value: LocalizedText | null | undefined, note = '')}
	{#if hasText(value)}
		<section class="rounded-lg border border-gray-200 bg-white p-4">
			<h4 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
				{title}{#if note}<span class="ml-2 font-normal tracking-normal normal-case">{note}</span
					>{/if}
			</h4>
			<p class="mt-1.5 text-sm text-gray-800">{@render text(value)}</p>
		</section>
	{/if}
{/snippet}

<div
	use:portal
	class="fixed inset-0 z-1100 flex items-center justify-center bg-slate-900/60 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="version-preview-title"
>
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		aria-label="Close preview"
		onclick={onClose}
		tabindex="-1"
	></button>

	<div
		class="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-gray-50 shadow-2xl"
	>
		<!-- Header -->
		<div class="border-b border-gray-200 bg-white px-6 pt-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<h3 id="version-preview-title" class="text-base font-semibold text-gray-900">
							{version.semver ? `Version ${version.semver}` : `Snapshot #${version.version_no}`}
						</h3>
						<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
							{KIND_LABEL[version.kind]}
						</span>
						{#if version.is_published}
							<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
								Live
							</span>
						{/if}
						<span class="text-xs text-gray-400">read-only</span>
					</div>
					<p class="mt-0.5 text-xs text-gray-500">
						{formatDate(version.created_at)}{version.created_by_name
							? ` · ${version.created_by_name}`
							: ''}{version.label ? ` · ${version.label}` : ''}
					</p>
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
				<div class="flex gap-1" role="tablist">
					{#each tabs as [id, label] (id)}
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
						</button>
					{/each}
				</div>
				{#if version.languages.length > 1}
					<div class="mb-1.5 flex gap-1">
						{#each version.languages as code (code)}
							<button
								type="button"
								class="rounded-full px-2.5 py-1 text-xs font-medium {language === code
									? 'bg-primary text-white'
									: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
								onclick={() => (language = code)}
								title={inProgress(code)
									? `${languageName(code)}: in progress, not offered to respondents`
									: languageName(code)}
							>
								{code}{code === version.default_language ? ' (default)' : ''}
								{#if inProgress(code)}
									<span
										class="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
									></span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Body -->
		<div class="flex flex-col gap-3 overflow-y-auto px-6 py-4">
			{#if inProgress(language)}
				<p class="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
					<i class="fa-solid fa-person-digging mr-1"></i>
					{languageName(language)} was in progress in this version: respondents were not offered it.
				</p>
			{/if}
			{#if tab === 'guide'}
				{@render block('Framing', guide.framing, 'only the AI interviewer sees this')}
				{@render block('Introduction', guide.introduction)}

				{#each sections as section, s (section.id ?? s)}
					<section class="rounded-lg border border-gray-200 bg-white">
						<div class="border-b border-gray-100 px-4 py-3">
							<div class="flex items-center gap-2">
								<h4 class="text-sm font-semibold text-gray-900">Section {s + 1}</h4>
								{#if section.shuffle}
									<span class="text-xs text-gray-500"
										><i class="fa-solid fa-shuffle"></i> shuffled</span
									>
								{/if}
							</div>
							{#if hasText(section.description)}
								<p class="mt-1 text-sm text-gray-600">{@render text(section.description)}</p>
							{/if}
						</div>
						<ol class="divide-y divide-gray-100">
							{#each section.questions ?? [] as question, q (question.id ?? q)}
								{@const item = question.survey_item}
								<li class="flex gap-3 px-4 py-3">
									<span class="w-8 shrink-0 pt-0.5 text-xs font-medium text-gray-400 tabular-nums">
										{s + 1}.{q + 1}
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-sm text-gray-900">{@render text(question.main_question)}</p>
										{#if hasText(question.description)}
											<p class="mt-0.5 text-xs text-gray-500">
												{@render text(question.description)}
											</p>
										{/if}

										{#if item}
											<div class="mt-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
												<p class="text-xs font-medium text-gray-500">
													{SURVEY_LABEL[item.type ?? ''] ?? item.type}
												</p>
												{#if options(question).length}
													<ul class="mt-1 flex flex-col gap-0.5">
														{#each options(question) as option, o (option.id ?? o)}
															<li class="flex items-center gap-2 text-gray-700">
																<i
																	class="fa-regular {item.type === 'checkbox'
																		? 'fa-square'
																		: 'fa-circle'} text-xs text-gray-400"
																></i>
																{@render text(option.text)}
															</li>
														{/each}
														{#if 'with_other' in item && item.with_other}
															<li class="text-gray-500 italic">Other…</li>
														{/if}
													</ul>
												{:else if item.type === 'slider'}
													<p class="mt-1 text-gray-700">
														{item.min}{hasText(item.min_label)
															? ' '
															: ''}{#if hasText(item.min_label)}({@render text(
																item.min_label
															)}){/if}
														→ {item.max}{hasText(item.max_label)
															? ' '
															: ''}{#if hasText(item.max_label)}({@render text(
																item.max_label
															)}){/if}
													</p>
												{/if}
											</div>
										{/if}

										{#if question.probes?.some(hasText)}
											<div class="mt-2 text-xs text-gray-500">
												<p class="font-medium">Suggested probes</p>
												<ul class="mt-0.5 list-disc pl-4">
													{#each question.probes as probe, p (p)}
														{#if hasText(probe)}<li>{@render text(probe)}</li>{/if}
													{/each}
												</ul>
											</div>
										{/if}

										<div class="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-500">
											{#if !item && question.max_probes_n !== 0}
												<span class="rounded bg-gray-100 px-1.5 py-0.5">
													<i class="fa-solid fa-comments"></i>
													up to {question.max_probes_n ?? 3} probes
												</span>
											{/if}
											{#if question.conditions}
												<span class="rounded bg-gray-100 px-1.5 py-0.5">
													<i class="fa-solid fa-code-branch"></i> conditional
												</span>
											{/if}
											{#if question.image}
												<span class="rounded bg-gray-100 px-1.5 py-0.5">
													<i class="fa-solid fa-image"></i> image
												</span>
											{/if}
											{#if question.shuffle}
												<span class="rounded bg-gray-100 px-1.5 py-0.5">
													<i class="fa-solid fa-shuffle"></i> shuffled
												</span>
											{/if}
										</div>
									</div>
								</li>
							{:else}
								<li class="px-4 py-3 text-sm text-gray-400">No questions</li>
							{/each}
						</ol>
					</section>
				{/each}

				{@render block('Outro', guide.outro)}
				{@render block('Outro when ended early', guide.alt_outro)}
			{:else if tab === 'consent' && version.consent}
				{@render untranslatedNote([version.consent.title, version.consent.text])}
				<ConsentPreview
					title={read(version.consent.title).value}
					text={read(version.consent.text).value}
					scroll={false}
				/>
			{:else if tab === 'welcome' && version.welcome}
				{@render untranslatedNote([version.welcome.title, version.welcome.text])}
				<WelcomePreview
					title={read(version.welcome.title).value}
					text={read(version.welcome.text).value}
					videoUrl={version.welcome.video_file_name
						? `/assets/videos/${version.welcome.video_file_name}`
						: null}
					email={version.welcome.email}
					scroll={false}
				/>
			{:else if tab === 'emails'}
				{#each [['Invitation', version.emails.invite], ['Reminder', version.emails.reminder]] as const as [name, email] (name)}
					<section class="flex flex-col gap-1.5">
						<h4 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">{name}</h4>
						{@render untranslatedNote([email?.subject, email?.template])}
						<EmailPreview
							{projectId}
							subject={read(email?.subject).value}
							html={read(email?.template).value}
						/>
					</section>
				{/each}
			{:else if tab === 'agents'}
				<section class="rounded-lg border border-gray-200 bg-white">
					<table class="w-full text-sm">
						<thead class="border-b border-gray-100 text-left text-xs text-gray-500">
							<tr>
								<th class="px-4 py-2 font-medium">Agent</th>
								<th class="px-4 py-2 font-medium">Model</th>
								<th class="px-4 py-2 font-medium">Temperature</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each agents as agent (agent.name)}
								<tr class={[agent.include === false && 'text-gray-400']}>
									<td class="px-4 py-2 text-gray-900">
										{AGENT_LABEL[agent.name] ?? agent.name}
										{#if agent.include === false}
											<span class="ml-1 text-xs">(off)</span>
										{/if}
									</td>
									<td class="px-4 py-2 font-mono text-xs">{agent.model ?? '—'}</td>
									<td class="px-4 py-2 tabular-nums">{agent.temperature ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>

				<section class="rounded-lg border border-gray-200 bg-white p-4">
					<h4 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
						Probing prompt
					</h4>
					{#if customSlots.length === 0}
						<p class="mt-1.5 text-sm text-gray-600">The default prompt, unchanged.</p>
					{:else}
						<dl class="mt-2 flex flex-col gap-3 text-sm">
							{#each customSlots as [label, value] (label)}
								<div>
									<dt class="font-medium text-gray-700">{label}</dt>
									<dd class="mt-0.5 text-gray-700">
										{#if Array.isArray(value)}
											<ul class="list-disc pl-5">
												{#each value as line, i (i)}<li>{line}</li>{/each}
											</ul>
										{:else}
											<p class="whitespace-pre-wrap">{value}</p>
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
						<p class="mt-3 text-xs text-gray-500">Slots not listed use the default.</p>
					{/if}
				</section>

				{#if overriddenTemplates.length}
					<section class="rounded-lg border border-gray-200 bg-white p-4">
						<h4 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
							Prompt template overrides
						</h4>
						<ul class="mt-1.5 list-disc pl-5 font-mono text-xs text-gray-700">
							{#each overriddenTemplates as name (name)}<li>{name}</li>{/each}
						</ul>
					</section>
				{/if}
			{/if}
		</div>
	</div>
</div>
