import { Marked, type Tokens } from 'marked';

/** URL schemes a link in an assistant reply may use. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function safeHref(href: string): string | null {
	try {
		const url = new URL(href);
		return SAFE_SCHEMES.has(url.protocol) ? url.href : null;
	} catch {
		// Relative or malformed: nothing in a reply should point into the app.
		return null;
	}
}

/**
 * The assistant writes Markdown, and its replies are shaped by whatever the
 * user and the guide put in front of it, so its output is not trusted markup.
 * Raw HTML is shown as text, links keep only absolute http(s)/mailto targets
 * and open in a new tab, and images are reduced to their alt text so a reply
 * cannot make the browser fetch anything.
 */
const assistantMarked = new Marked({
	gfm: true,
	breaks: true,
	async: false,
	renderer: {
		html({ text }: Tokens.HTML | Tokens.Tag) {
			return escapeHtml(text);
		},
		link({ href, title, tokens }: Tokens.Link) {
			const label = this.parser.parseInline(tokens);
			const safe = safeHref(href);
			if (!safe) return label;
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
			return `<a href="${escapeHtml(safe)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
		},
		image({ text }: Tokens.Image) {
			return escapeHtml(text);
		}
	}
});

/** Render an assistant reply's Markdown to HTML that is safe for `{@html}`. */
export function renderAssistantMarkdown(text: string): string {
	return assistantMarked.parse(text) as string;
}
