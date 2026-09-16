<script lang="ts">
	import type { CodingPublic } from '$lib/api/types.gen';
	import {
		DEFAULT_SCORE_MAX,
		DEFAULT_SCORE_MIN,
		ancestorsOf,
		displayName,
		outlineOf,
		type Code
	} from '$lib/coding/codingTree';
	import CodedText from '$lib/components/analysis/CodedText.svelte';
	import Info from '$lib/components/Info.svelte';
	import { isSpan, spanText } from '$lib/utils/coding';
	import { getContrastColor } from '$lib/utils/colors';

	interface Props {
		/** The project's codebook. Read-only here — it is edited on the Coding page. */
		codes: readonly Code[];
		/** Every coding on this message, whoever made it. */
		codings: CodingPublic[];
		content: string;
		currentUserId: string;
		saving?: boolean;
		onApply: (codeId: string, span: Span | null, value: number | null) => void;
		onChangeValue: (codingId: string, value: number) => void;
		onRemove: (codingId: string) => void;
		onClose: () => void;
	}

	type Span = { start: number; end: number };

	let {
		codes,
		codings,
		content,
		currentUserId,
		saving = false,
		onApply,
		onChangeValue,
		onRemove,
		onClose
	}: Props = $props();

	/**
	 * What the next code will be applied to: a stretch the reader selected, or
	 * the whole turn when they have selected nothing.
	 *
	 * The two are different claims rather than a precise and a sloppy version of
	 * one, so the panel always says which it is about to make.
	 */
	let span = $state<Span | null>(null);
	let filter = $state('');

	let mine = $derived(codings.filter((coding) => coding.user_id === currentUserId));

	/**
	 * The codebook as a list, narrowed by the filter.
	 *
	 * A code that matches keeps its ancestors, even where they do not: a code
	 * read out of its branch is a different code, and `Cost` under `Barriers`
	 * is not `Cost` under `Interview situation`.
	 */
	let rows = $derived.by(() => {
		const all = outlineOf(codes);
		const query = filter.trim().toLowerCase();
		if (!query) return all;

		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local of this pure computation, never escapes
		const keep = new Set<string>();
		for (const { code } of all) {
			if (!code.name.toLowerCase().includes(query)) continue;
			keep.add(code.id);
			for (const ancestor of ancestorsOf(codes, code.id)) keep.add(ancestor.id);
		}
		return all.filter(({ code }) => keep.has(code.id));
	});

	/** This coder's coding of `code` on the passage in hand, if there is one. */
	function applied(code: Code): CodingPublic | undefined {
		return mine.find(
			(coding) =>
				coding.code_id === code.id &&
				(coding.start_offset ?? null) === (span?.start ?? null) &&
				(coding.end_offset ?? null) === (span?.end ?? null)
		);
	}

	function toggleTag(code: Code) {
		const existing = applied(code);
		if (existing) onRemove(existing.id);
		else onApply(code.id, span, null);
	}

	function setScore(code: Code, value: number) {
		const existing = applied(code);
		if (!existing) {
			onApply(code.id, span, value);
			return;
		}
		// Clicking the value it already carries clears the coding: a score with
		// no value is not a score, so there is nothing else that click could mean.
		if (existing.value_int === value) onRemove(existing.id);
		else onChangeValue(existing.id, value);
	}

	function scale(code: Code): number[] {
		const min = code.minValue ?? DEFAULT_SCORE_MIN;
		const max = code.maxValue ?? DEFAULT_SCORE_MAX;
		return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-lg">
	<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
		<h3 class="text-sm font-semibold text-gray-800">Code this passage</h3>
		<button
			type="button"
			class="cursor-pointer text-gray-400 hover:text-gray-600"
			aria-label="Close"
			onclick={onClose}
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	</div>

	<!-- The passage, and what is currently selected in it. Shown here rather
	     than read off the bubble above: the bubble renders markdown and survey
	     items, so its characters are not the ones an offset counts. -->
	<div class="border-b border-gray-100 px-4 py-3">
		<CodedText {content} {codings} {codes} onselect={(next) => (span = next)} />
		<p class="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
			{#if span}
				<i class="fa-solid fa-quote-left text-[9px] text-gray-400"></i>
				<span class="truncate">Coding “{content.slice(span.start, span.end)}”</span>
				<button
					type="button"
					class="cursor-pointer text-gray-400 underline underline-offset-2 hover:text-gray-600"
					onclick={() => (span = null)}
				>
					whole turn instead
				</button>
			{:else}
				Coding the whole turn — select words above to code just those.
			{/if}
		</p>
	</div>

	{#if codes.length === 0}
		<p class="px-4 py-6 text-center text-sm text-gray-500">
			This project has no codebook yet. Build one on the Coding page, then come back to apply it.
		</p>
	{:else}
		{#if outlineOf(codes).length > 8}
			<div class="border-b border-gray-100 px-4 py-2">
				<input
					type="search"
					bind:value={filter}
					placeholder="Filter codes"
					class="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
				/>
			</div>
		{/if}

		<div class="max-h-80 overflow-y-auto px-2 py-2">
			{#each rows as row (row.code.id)}
				{@const code = row.code}
				{@const here = applied(code)}
				<div style="padding-left: {row.depth * 14}px">
					{#if code.kind === 'group'}
						<!-- A group organises the codebook and is never applied; drawn as
						     the heading it is rather than as a button the API refuses. -->
						<div class="flex items-center gap-1.5 px-2 py-1">
							<span class="h-2 w-2 rounded-[2px]" style="background-color: {code.color}"></span>
							<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								{displayName(code.name)}
							</span>
							{#if code.definition}<Info text={code.definition} />{/if}
						</div>
					{:else if code.kind === 'score'}
						<div class="px-2 py-1">
							<div class="mb-1 flex items-center gap-1.5">
								<span class="text-xs font-medium text-gray-700">{displayName(code.name)}</span>
								{#if code.definition}<Info text={code.definition} />{/if}
							</div>
							<div class="flex flex-wrap items-center gap-1">
								{#each scale(code) as value (value)}
									<button
										type="button"
										class="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-xs font-medium transition-all disabled:cursor-default {here?.value_int ===
										value
											? 'text-white'
											: 'bg-gray-50 text-gray-600 hover:bg-gray-100'}"
										style={here?.value_int === value ? `background-color: ${code.color}` : ''}
										onclick={() => setScore(code, value)}
										disabled={saving}
									>
										{value}
									</button>
								{/each}
							</div>
						</div>
					{:else}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-gray-50 disabled:cursor-default"
							onclick={() => toggleTag(code)}
							disabled={saving}
							aria-pressed={here !== undefined}
							title={code.definition || undefined}
						>
							<span
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px]"
								style={here
									? `background-color: ${code.color}; color: ${getContrastColor(code.color)}`
									: `border: 1.5px solid ${code.color}`}
							>
								{#if here}<i class="fa-solid fa-check"></i>{/if}
							</span>
							<span class="truncate text-sm {here ? 'text-gray-900' : 'text-gray-600'}">
								{displayName(code.name)}
							</span>
						</button>
					{/if}
				</div>
			{:else}
				<p class="px-2 py-4 text-center text-sm text-gray-400">No code matches “{filter}”.</p>
			{/each}
		</div>
	{/if}

	{#if mine.length > 0}
		<!-- Everything this coder has put on the message, including the spans
		     that are not the one currently selected -- otherwise a coding made
		     against another stretch is invisible and gets made twice. -->
		<div class="border-t border-gray-100 px-4 py-2">
			<p class="mb-1.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
				Your coding of this message
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#each mine as coding (coding.id)}
					{@const code = codes.find((candidate) => candidate.id === coding.code_id)}
					{#if code}
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
							style="background-color: {code.color}; color: {getContrastColor(code.color)}"
							title={isSpan(coding) ? `“${spanText(coding, content)}”` : 'The whole turn'}
						>
							{#if isSpan(coding)}<i class="fa-solid fa-quote-left text-[7px] opacity-80"></i>{/if}
							{displayName(code.name)}{coding.value_int === null || coding.value_int === undefined
								? ''
								: `: ${coding.value_int}`}
							<button
								type="button"
								class="-mr-0.5 cursor-pointer"
								aria-label="Remove {displayName(code.name)}"
								onclick={() => onRemove(coding.id)}
								disabled={saving}
							>
								<i class="fa-solid fa-xmark text-[9px]"></i>
							</button>
						</span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
