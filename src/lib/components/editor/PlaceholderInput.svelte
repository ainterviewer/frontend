<script lang="ts" module>
	import { Extension } from '@tiptap/core';

	/** A subject line is one line: swallow the keys that would split it. */
	const SingleLine = Extension.create({
		name: 'singleLine',
		addKeyboardShortcuts: () => ({
			Enter: () => true,
			'Shift-Enter': () => true,
			'Mod-Enter': () => true
		})
	});

	function escapeHtml(text: string) {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
</script>

<script lang="ts">
	import type { TemplatePlaceholder } from '$lib/api/types.gen';
	import { placeholdersToNodes } from '$lib/tiptap/placeholders';
	import { TemplatePlaceholderNode } from '$lib/tiptap/templatePlaceholder';
	import { Editor } from '@tiptap/core';
	import Document from '@tiptap/extension-document';
	import Paragraph from '@tiptap/extension-paragraph';
	import Text from '@tiptap/extension-text';
	import { untrack } from 'svelte';

	interface Props {
		/** Plain text, with placeholders in their literal `{{ key }}` form. */
		value: string;
		onChange: (value: string) => void;
		onFocus?: () => void;
		id?: string;
		ariaLabel?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value,
		onChange,
		onFocus,
		id,
		ariaLabel,
		placeholder = '',
		disabled = false,
		class: className = ''
	}: Props = $props();

	let element: HTMLDivElement;
	let editor = $state<Editor | null>(null);

	// What we last handed to the parent. Anything else arriving through `value`
	// is an outside change (template loaded, tab switched) and has to be pushed
	// into the document; echoing our own text back would reset the cursor.
	// Deliberately not `$state`: only the effects below read it.
	let lastEmitted: string | null = null;

	const isEmpty = $derived(!value);

	function toDocument(text: string) {
		return `<p>${placeholdersToNodes(escapeHtml(text))}</p>`;
	}

	export function insert(key: TemplatePlaceholder) {
		editor?.chain().focus().insertTemplatePlaceholder(key).run();
	}

	export function focus() {
		editor?.commands.focus();
	}

	// Built once: every value read is untracked, so a keystroke cannot tear the
	// editor down and rebuild it.
	$effect(() => {
		const instance = untrack(
			() =>
				new Editor({
					element,
					extensions: [Document, Paragraph, Text, TemplatePlaceholderNode, SingleLine],
					content: toDocument(value),
					editorProps: {
						attributes: {
							class: 'px-2 py-1 text-sm focus:outline-none',
							role: 'textbox',
							...(ariaLabel ? { 'aria-label': ariaLabel } : {})
						}
					},
					onUpdate: ({ editor: e }) => {
						const text = e.getText();
						lastEmitted = text;
						onChange(text);
					},
					onFocus: () => onFocus?.()
				})
		);
		editor = instance;
		lastEmitted = untrack(() => value);
		return () => {
			instance.destroy();
			editor = null;
		};
	});

	$effect(() => {
		if (!editor || value === lastEmitted) return;
		editor.commands.setContent(toDocument(value), { emitUpdate: false });
		lastEmitted = value;
	});

	$effect(() => {
		editor?.setEditable(!disabled);
	});
</script>

<div
	class="relative rounded border border-gray-300 focus-within:border-primary {className}"
	class:bg-gray-50={disabled}
	class:opacity-60={disabled}
>
	{#if isEmpty && placeholder}
		<span class="pointer-events-none absolute px-2 py-1 text-sm text-gray-400">{placeholder}</span>
	{/if}
	<div bind:this={element} {id}></div>
</div>
