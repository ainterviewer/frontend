import { mergeAttributes, Node, nodeInputRule, type Range } from '@tiptap/core';
import {
	isUrlPlaceholder,
	PLACEHOLDER_KEYS,
	PLACEHOLDER_LABELS,
	placeholderText
} from './placeholders';
import type { TemplatePlaceholder } from '$lib/api/types.gen';

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		templatePlaceholder: {
			insertTemplatePlaceholder: (key: TemplatePlaceholder) => ReturnType;
		};
	}
}

/**
 * Renders `{{ name }}` as an atomic chip in the editor. The stored template
 * keeps the literal `{{ name }}` form the backend renderer expects, so the two
 * shapes are bridged at the editor boundary: `placeholdersToNodes()` on the way
 * in, `nodesToPlaceholders()` on the way out.
 */
export const TemplatePlaceholderNode = Node.create({
	name: 'templatePlaceholder',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	draggable: true,

	addAttributes() {
		return {
			key: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-placeholder'),
				renderHTML: (attributes) => ({ 'data-placeholder': attributes.key })
			}
		};
	},

	parseHTML() {
		return [{ tag: 'span[data-placeholder]' }];
	},

	renderHTML({ HTMLAttributes }) {
		// `nodesToPlaceholders()` turns this back into literal `{{ key }}` text on
		// the way out of the editor -- the stored template never sees the span.
		return ['span', mergeAttributes(HTMLAttributes)];
	},

	renderText({ node }) {
		return placeholderText(node.attrs.key);
	},

	addCommands() {
		return {
			insertTemplatePlaceholder:
				(key) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: { key } })
		};
	},

	addInputRules() {
		return [
			nodeInputRule({
				// Typing the raw placeholder produces the chip too, so pasted or
				// hand-written templates do not end up in a different shape.
				find: new RegExp(`\\{\\{\\s*(${PLACEHOLDER_KEYS.join('|')})\\s*\\}\\}$`),
				type: this.type,
				getAttributes: (match) => ({ key: match[1] })
			})
		];
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			const key = node.attrs.key as TemplatePlaceholder;
			const dom = document.createElement('span');
			dom.className = 'tpl-chip';
			dom.setAttribute('data-placeholder', key);
			dom.title = placeholderText(key);
			dom.contentEditable = 'false';

			if (isUrlPlaceholder(key)) {
				// The URL placeholders resolve to a personal link rather than to text,
				// which is worth signalling wherever the chip appears.
				const icon = document.createElement('i');
				icon.className = 'fa-solid fa-link tpl-chip__icon';
				icon.setAttribute('aria-hidden', 'true');
				dom.appendChild(icon);
			}

			const label = document.createElement('span');
			label.className = 'tpl-chip__label';
			label.textContent = PLACEHOLDER_LABELS[key] ?? key;
			dom.appendChild(label);

			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'tpl-chip__remove';
			remove.setAttribute('aria-label', `Remove ${PLACEHOLDER_LABELS[key] ?? key} placeholder`);
			remove.textContent = '×';
			remove.addEventListener('mousedown', (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!editor.isEditable) return;
				const pos = getPos();
				if (typeof pos !== 'number') return;
				const range: Range = { from: pos, to: pos + node.nodeSize };
				editor.chain().focus().deleteRange(range).run();
			});
			dom.appendChild(remove);

			return { dom };
		};
	}
});
