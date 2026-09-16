<script lang="ts">
	import type { CodingPublic } from '$lib/api/types.gen';
	import type { Code } from '$lib/coding/codingTree';
	import { segmentByCodings } from '$lib/utils/coding';

	interface Props {
		content: string;
		codings: CodingPublic[];
		codes: readonly Code[];
		/**
		 * The stretch the reader has selected, so the panel can show what a code
		 * would be applied to. `null` once the selection is dropped.
		 */
		onselect: (span: { start: number; end: number } | null) => void;
	}

	let { content, codings, codes, onselect }: Props = $props();

	let segments = $derived(segmentByCodings(content, codings, codes));
	let root: HTMLElement;

	/**
	 * The offset a point in the DOM has in the message's own characters.
	 *
	 * Measured here rather than on the message bubble above, and that is the
	 * whole reason this component exists: the bubble renders markdown, survey
	 * items and audio, so the characters on screen are not the characters in
	 * `content` and a range taken there would point at the wrong words.
	 *
	 * Each segment carries the offset it starts at, so the sum only ever runs
	 * over one segment. Counting from the top of the element instead would make
	 * the answer depend on every text node before it -- including whitespace a
	 * formatter is free to introduce between tags, which is invisible in the
	 * markup and would silently shift every offset the reader produces.
	 */
	function offsetOf(node: Node, offset: number): number | null {
		const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
		const segment = element?.closest<HTMLElement>('[data-start]');
		if (!segment || !root.contains(segment)) return null;

		const base = Number(segment.dataset.start);
		if (Number.isNaN(base)) return null;

		const walker = document.createTreeWalker(segment, NodeFilter.SHOW_TEXT);
		let within = 0;
		let text = walker.nextNode();
		while (text) {
			if (text === node) return base + within + offset;
			within += text.textContent?.length ?? 0;
			text = walker.nextNode();
		}
		// The point is the segment itself rather than a node inside it, which is
		// what a selection that ends exactly on a boundary looks like.
		return base + within;
	}

	function readSelection() {
		const selection = document.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
			onselect(null);
			return;
		}
		const range = selection.getRangeAt(0);
		if (!root.contains(range.commonAncestorContainer)) return;

		const start = offsetOf(range.startContainer, range.startOffset);
		const end = offsetOf(range.endContainer, range.endOffset);
		if (start === null || end === null || start === end) {
			onselect(null);
			return;
		}
		onselect({ start: Math.min(start, end), end: Math.max(start, end) });
	}
</script>

<!-- `pointerup` and `keyup` rather than `selectionchange`: the latter fires on
     every character as a drag crosses it, and each one would re-render the
     panel under the reader's pointer. -->
<!-- The listeners read a text selection rather than offering an action, so
     there is no control to put them on: selecting the text is the interaction. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- prettier-ignore -->
<p
	bind:this={root}
	class="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 select-text"
	onpointerup={readSelection}
	onkeyup={readSelection}
>{#each segments as segment (segment.start)}{#if segment.codings.length === 0}<span data-start={segment.start}>{segment.text}</span>{:else}{@const top = segment.codings[segment.codings.length - 1].code}<mark data-start={segment.start} class="rounded-sm bg-transparent px-px" style="box-shadow: inset 0 -0.45em 0 {top.color}33; border-bottom: 2px solid {top.color}" title={segment.codings.map(({ code }) => code.name).join(' · ')}>{segment.text}</mark>{/if}{/each}</p>
