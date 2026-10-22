<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ExternalParam } from '$lib/api/types.gen';
	import Select from '$lib/components/Select.svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const projectId = $derived(page.params.project_id as string);
	const lang = $derived(page.params.lang ?? 'en');
	const isDemo = $derived(page.data.user?.scope === 'demo');
	const hasPreviewFeatures = $derived(!!page.data.user?.with_preview_features);

	/** Picking no language leaves it to the respondent, who is then asked
	 * whenever the project offers more than one. */
	const ANY_LANGUAGE = '';
	let linkLanguage = $state(ANY_LANGUAGE);
	const languageItems = $derived([
		{ value: ANY_LANGUAGE, label: 'Let respondent choose' },
		...data.publishedLanguages.map((l) => ({
			value: l.code.toLowerCase(),
			label: l.is_default ? `${l.name} (default)` : l.name
		}))
	]);

	const linkParams: ExternalParam[] = $derived(page.data.project?.external_params ?? []);
	let paramValues = $state<Record<string, string>>({});

	/** Required, without a default to fall back on, and left empty: a link
	 * without it is turned away on arrival. */
	const missingParams = $derived(
		linkParams.filter((p) => p.required && p.default == null && !paramValues[p.name]?.trim())
	);

	const query = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local of this pure computation, never escapes
		const q = new URLSearchParams();
		if (linkLanguage) q.set('lang', linkLanguage);
		for (const p of linkParams) {
			const value = paramValues[p.name]?.trim();
			if (value) q.set(p.name, value);
		}
		return q.toString();
	});

	// From `page.url` rather than `window`, so the link is there on first paint.
	const interviewURL = $derived(
		`${page.url.origin}/interview?id=${projectId}${query ? `&${query}` : ''}`
	);

	// The QR is rendered by the backend, so it follows the link only once
	// typing stops rather than costing a request per keystroke.
	let qrQuery = $state('');
	$effect(() => {
		const next = query;
		const timer = setTimeout(() => (qrQuery = next), 400);
		return () => clearTimeout(timer);
	});
	const qrSrc = $derived(`/api/projects/${projectId}/qr.png${qrQuery ? `?${qrQuery}` : ''}`);

	// The first QR is taken as shown: it may well have loaded before hydration,
	// when no load handler was there to hear it. Every later one is waited for,
	// since the backend renders it on request and the old one would otherwise
	// sit there passing for the new link.
	let shownQrSrc = $state(`/api/projects/${page.params.project_id}/qr.png`);
	let qrFailed = $state(false);
	const qrPending = $derived(query !== qrQuery || shownQrSrc !== qrSrc);

	let linkInput = $state<HTMLInputElement>();
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(interviewURL);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard access (an insecure origin, say): leave the link
			// selected so it can be copied by hand.
			linkInput?.select();
			toast.error('Could not copy the link. It is selected, so you can copy it yourself.');
		}
	}
</script>

<div class="w-[80%] max-w-[1000px]">
	<h1 class="page-title">Distribution</h1>
	<p class="mb-6 text-gray-600">
		Share your interview with a link or a QR code. Both open the same interview.
	</p>

	{#if data.notPublished}
		<div
			class="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
			role="status"
		>
			<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
			<p>
				<span class="font-semibold">This interview isn't published yet.</span>
				Respondents who open the link are told there is nothing to answer.
				<a
					class="font-medium underline"
					href={resolve('/dashboard/projects/[project_id]/[lang]/setup/guide', {
						project_id: projectId,
						lang
					})}>Publish it from the interview guide</a
				>.
			</p>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
		<section class="rounded-lg border border-gray-200 p-5">
			<h2 class="text-lg font-semibold">Interview link</h2>
			<p class="mt-1 mb-4 text-sm text-gray-600">For email, chat or a survey panel.</p>

			{#if data.publishedLanguages.length > 1}
				<div class="mb-4 max-w-xs">
					<span class="mb-1 block text-sm font-medium text-gray-700">Language</span>
					<Select bind:value={linkLanguage} items={languageItems} aria-label="Link language" />
				</div>
			{/if}

			{#if linkParams.length > 0}
				<fieldset class="mb-4">
					<legend class="mb-1 text-sm font-medium text-gray-700">Link parameters</legend>
					<p class="mb-2 text-xs text-gray-500">
						Values fixed for everyone who uses this link. Leave a field empty for your survey panel
						to fill in.
						<a
							class="underline"
							href={resolve('/dashboard/projects/[project_id]/[lang]/setup', {
								project_id: projectId,
								lang
							})}>Edit parameters in Setup</a
						>.
					</p>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each linkParams as param (param.name)}
							<div>
								<!-- The selects are named by their aria-label instead. -->
								<label
									for={param.type === 'enum' || param.type === 'bool'
										? undefined
										: `link-param-${param.name}`}
									class="mb-1 block font-mono text-xs text-gray-600"
									class:required={param.required && param.default == null}>{param.name}</label
								>
								{#if param.type === 'enum' || param.type === 'bool'}
									<Select
										bind:value={
											() => paramValues[param.name] ?? '', (v) => (paramValues[param.name] = v)
										}
										items={[
											{
												value: '',
												label: param.default != null ? `Default (${param.default})` : 'Not set'
											},
											...(param.type === 'bool' ? ['true', 'false'] : (param.options ?? [])).map(
												(o) => ({ value: o, label: o })
											)
										]}
										aria-label={param.name}
									/>
								{:else}
									<input
										id="link-param-{param.name}"
										type={param.type === 'str' ? 'text' : 'number'}
										step={param.type === 'float' ? 'any' : undefined}
										value={paramValues[param.name] ?? ''}
										oninput={(e) => (paramValues[param.name] = e.currentTarget.value)}
										placeholder={param.default != null ? `Default: ${param.default}` : ''}
										class="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
									/>
								{/if}
								{#if param.description}
									<p class="mt-1 text-xs text-gray-500">{param.description}</p>
								{/if}
							</div>
						{/each}
					</div>
				</fieldset>
			{/if}

			<label for="interview-link" class="mb-1 block text-sm font-medium text-gray-700">Link</label>
			<input
				id="interview-link"
				bind:this={linkInput}
				readonly
				value={interviewURL}
				onfocus={(e) => e.currentTarget.select()}
				class="h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 font-mono text-sm text-gray-800 focus:ring-2 focus:ring-primary/20 focus:outline-none"
			/>
			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onclick={copyLink}
					disabled={isDemo}
					class="inline-flex h-10 w-32 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50"
				>
					{#if copied}
						<i class="fa-solid fa-check"></i> Copied
					{:else}
						<i class="fa-regular fa-copy"></i> Copy link
					{/if}
				</button>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={interviewURL}
					target="_blank"
					rel="noopener"
					class="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					<i class="fa-solid fa-arrow-up-right-from-square"></i> Open
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
			{#if missingParams.length > 0}
				<p class="mt-2 text-sm text-amber-700">
					<i class="fa-solid fa-triangle-exclamation"></i>
					Respondents need {missingParams.map((p) => p.name).join(', ')} in the link, or it is turned
					away as invalid. Fill {missingParams.length === 1 ? 'it' : 'them'} in above, or make sure your
					survey panel adds {missingParams.length === 1 ? 'it' : 'them'}.
				</p>
			{/if}
		</section>

		<section class="rounded-lg border border-gray-200 p-5">
			<h2 class="text-lg font-semibold">QR code</h2>
			<p class="mt-1 mb-4 text-sm text-gray-600">For posters, flyers and slides.</p>
			<div class="relative h-56 w-56" aria-busy={qrPending}>
				<img
					src={qrSrc}
					alt="QR code for the interview link"
					class={['h-56 w-56 transition-opacity', qrPending && 'opacity-30']}
					onload={(e) => {
						shownQrSrc = e.currentTarget.getAttribute('src') ?? '';
						qrFailed = false;
					}}
					onerror={(e) => {
						shownQrSrc = e.currentTarget.getAttribute('src') ?? '';
						qrFailed = true;
					}}
				/>
				{#if qrPending}
					<div class="absolute inset-0 flex items-center justify-center text-2xl text-primary">
						<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
						<span class="sr-only">Updating QR code</span>
					</div>
				{/if}
			</div>
			{#if qrFailed && !qrPending}
				<p class="mt-2 text-sm text-red-600">The QR code could not be loaded.</p>
			{/if}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={qrSrc}
				download="interview-qr.png"
				class="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
				class:pointer-events-none={isDemo || qrPending || qrFailed}
				class:opacity-50={isDemo || qrPending || qrFailed}
				aria-disabled={isDemo || qrPending || qrFailed}
				tabindex={isDemo || qrPending || qrFailed ? -1 : undefined}
			>
				<i class="fa-solid fa-download"></i> Download PNG
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</section>
	</div>

	{#if hasPreviewFeatures}
		<p class="mt-6 text-sm text-gray-600">
			Inviting specific people? Add them under
			<a
				class="underline"
				href={resolve('/dashboard/projects/[project_id]/[lang]/distribution/participants', {
					project_id: projectId,
					lang
				})}>Participants</a
			>
			and send them an invitation from
			<a
				class="underline"
				href={resolve('/dashboard/projects/[project_id]/[lang]/distribution/email', {
					project_id: projectId,
					lang
				})}>Email</a
			>.
		</p>
	{/if}
</div>
