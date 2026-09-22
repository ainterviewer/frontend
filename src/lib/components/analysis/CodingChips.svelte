<script lang="ts">
	import type { CodingPublic } from '$lib/api/types.gen';
	import type { Code } from '$lib/coding/codingTree';
	import { authorName, codingLabel, isSpan, resolveCodings, spanText } from '$lib/utils/coding';
	import { getContrastColor } from '$lib/utils/colors';

	interface Props {
		codings: CodingPublic[];
		/** The project's codebook, to resolve each coding's code against. */
		codes: readonly Code[];
		/** The message's text, so a span chip can quote what it points at. */
		content: string;
		/**
		 * Whose codings these are. Only this coder's carry a remove button —
		 * the API refuses the rest, so offering it would be a lie.
		 */
		currentUserId?: string;
		/** Names the coder before their chips, where several have coded this. */
		showAuthor?: boolean;
		onRemove?: (codingId: string) => void;
		/**
		 * The chip under the pointer, or `null` on leaving it.
		 *
		 * A chip that names a stretch of the message says which stretch only if
		 * something can point at it; the caller draws the text and is the only
		 * one that can. Fired for every chip, not just the span ones, so the
		 * caller decides — a whole-turn coding has no span to light up, and the
		 * answer to "which words?" is "all of them".
		 */
		onHover?: (coding: CodingPublic | null) => void;
	}

	let {
		codings,
		codes,
		content,
		currentUserId = '',
		showAuthor = false,
		onRemove,
		onHover
	}: Props = $props();

	let resolved = $derived(resolveCodings(codings, codes));
	let author = $derived(codings[0]?.author);
</script>

{#if resolved.length > 0}
	{#if showAuthor && author}
		<span class="text-[10px] text-gray-400" title="Coded by {authorName(author)}">
			{authorName(author)}:
		</span>
	{/if}
	{#each resolved as entry (entry.coding.id)}
		{@const removable = onRemove && entry.coding.user_id === currentUserId}
		<!-- `rounded-xl` rather than `rounded-full`: half a one-line chip's
		     height, so a chip that fits on one line is still a capsule, while a
		     label that wraps becomes a rounded rectangle instead of a tall oval
		     whose ends curve in over its own words. -->
		<span
			class="group/chip inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium"
			class:opacity-70={showAuthor}
			onmouseenter={() => onHover?.(entry.coding)}
			onmouseleave={() => onHover?.(null)}
			onfocusin={() => onHover?.(entry.coding)}
			onfocusout={() => onHover?.(null)}
			role="presentation"
			style="background-color: {entry.code.color}; color: {getContrastColor(entry.code.color)}"
			title={isSpan(entry.coding)
				? `“${spanText(entry.coding, content)}”`
				: entry.code.definition || entry.code.name}
		>
			{#if isSpan(entry.coding)}
				<!-- A span coding is a claim about part of the turn, and a chip that
				     looked like every other one would say the wrong thing about the
				     rest of it. -->
				<i class="fa-solid fa-quote-left text-[7px] opacity-80"></i>
			{/if}
			{codingLabel(entry)}
			{#if removable}
				<button
					type="button"
					class="-mr-0.5 cursor-pointer opacity-0 transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100"
					aria-label="Remove {entry.code.name}"
					onclick={() => onRemove?.(entry.coding.id)}
				>
					<i class="fa-solid fa-xmark text-[9px]"></i>
				</button>
			{/if}
		</span>
	{/each}
{/if}
