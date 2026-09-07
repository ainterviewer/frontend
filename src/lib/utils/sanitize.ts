/**
 * A small HTML sanitiser for text that is authored inside the app.
 *
 * Interviewer messages come from the interview guide, which the project's own
 * collaborators write, and they legitimately contain markup -- an outro that
 * links to a support page, a bolded instruction. Respondent messages are
 * untrusted input and never go through here; they are rendered as text.
 *
 * "Authored by a collaborator" is not the same as "trusted", though: a guide is
 * editable by everyone a project is shared with, and it is replayed to every
 * respondent and to every analyst reading the transcript. So the markup is
 * reduced to an allowlist rather than passed through, and anything outside it
 * is escaped into visible text rather than dropped -- an author who mistypes a
 * tag sees the tag instead of silently losing the sentence inside it.
 *
 * This runs during SSR as well as in the browser, so it is a string pass and
 * not a DOM parse.
 */

/**
 * Tags that survive, mapped to the attributes each may keep.
 *
 * Inline only. The one render site is a chat bubble whose text is laid out
 * with `whitespace-pre-wrap`, so paragraphs and lists are already expressed as
 * newlines, and a block element inside that inline run lays out badly.
 */
const ALLOWED_TAGS: Record<string, readonly string[]> = {
	a: ['href'],
	b: [],
	strong: [],
	i: [],
	em: [],
	u: [],
	s: [],
	br: [],
	code: []
};

/** Tags with no closing half. */
const VOID_TAGS = new Set(['br']);

/**
 * Tags whose *content* is dropped along with them. Everywhere else escaping is
 * enough to make markup inert, but `<script>alert(1)</script>` left as visible
 * text is noise, not information.
 */
const OPAQUE_TAGS = new Set(['script', 'style']);

/** URL schemes an `href` may use. Notably not `javascript:` or `data:`. */
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/** A tag, with attribute values allowed to contain `>` inside quotes. */
const TAG_PATTERN = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** A character reference at the start of the string. */
const ENTITY_PATTERN = /^&(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;

const ATTRIBUTE_PATTERN =
	/([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The references a browser resolves before acting on a URL. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	colon: ':',
	tab: '\t',
	newline: '\n'
};

/** Escape a text run. `&` is left alone when it already starts a character reference. */
function escapeText(text: string): string {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === '<') out += '&lt;';
		else if (char === '>') out += '&gt;';
		else if (char === '&') out += ENTITY_PATTERN.test(text.slice(i, i + 12)) ? '&' : '&amp;';
		else out += char;
	}
	return out;
}

/** Escape a value going into a double-quoted attribute. */
function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function decodeEntities(value: string): string {
	return value.replace(
		/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g,
		(match, dec: string, hex: string, name: string) => {
			if (dec) return String.fromCodePoint(Number(dec));
			if (hex) return String.fromCodePoint(parseInt(hex, 16));
			return NAMED_ENTITIES[name.toLowerCase()] ?? match;
		}
	);
}

function parseAttributes(raw: string): Map<string, string> {
	const attributes = new Map<string, string>();
	for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) {
		attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attributes;
}

/**
 * Return the href if it is safe to follow, else null.
 *
 * The value is decoded and stripped of whitespace and control characters
 * first: `java&#9;script:` and `&#106;avascript:` are the same URL to a
 * browser, and neither of them looks like one here until it is decoded.
 */
function safeHref(raw: string): string | null {
	// eslint-disable-next-line no-control-regex
	const decoded = decodeEntities(raw).replace(/[\u0000-\u0020\u007f-\u00a0]/g, '');
	if (!decoded) return null;

	// Fragment- and path-relative links carry no scheme to check.
	if (decoded.startsWith('#') || decoded.startsWith('/')) return decoded;

	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(decoded);
	// No scheme at all is a relative URL, e.g. `kunet.ku.dk/page`.
	if (!scheme) return decoded;
	return SAFE_SCHEMES.has(scheme[1].toLowerCase()) ? decoded : null;
}

/** Render the opening tag, or null to drop the element while keeping its content. */
function openTag(name: string, attributes: Map<string, string>): string | null {
	if (name === 'a') {
		const href = safeHref(attributes.get('href') ?? '');
		// An anchor that goes nowhere safe is not worth keeping as an anchor,
		// but its label is still part of the sentence.
		if (!href) return null;
		// Guide links point off-site; open them away from the interview so a
		// respondent cannot navigate out of a session in progress.
		return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
	}

	const rendered = (ALLOWED_TAGS[name] ?? [])
		.filter((attribute) => attributes.has(attribute))
		.map((attribute) => ` ${attribute}="${escapeAttribute(attributes.get(attribute) ?? '')}"`)
		.join('');
	return `<${name}${rendered}>`;
}

/**
 * Reduce `html` to the allowlist above, escaping everything else.
 *
 * The output is balanced: stray closing tags are dropped and anything still
 * open at the end is closed, so the result is safe to hand to `{@html}`
 * without it swallowing the markup that follows it.
 */
export function sanitizeMarkup(html: string): string {
	if (!html) return '';

	let out = '';
	let cursor = 0;
	// `emitted` is false for elements dropped while their content was kept, so
	// that their closing tag is dropped with them.
	const stack: { name: string; emitted: boolean }[] = [];
	let skipUntil: string | null = null;

	for (const match of html.matchAll(TAG_PATTERN)) {
		const [tag, closing, rawName, rawAttributes] = match;
		const index = match.index ?? 0;
		const name = rawName.toLowerCase();

		if (skipUntil) {
			// Inside <script>/<style>: everything, text included, is discarded.
			if (closing && name === skipUntil) skipUntil = null;
			cursor = index + tag.length;
			continue;
		}

		out += escapeText(html.slice(cursor, index));
		cursor = index + tag.length;

		if (OPAQUE_TAGS.has(name)) {
			if (!closing) skipUntil = name;
			continue;
		}

		if (!(name in ALLOWED_TAGS)) {
			// Not in the allowlist: show the author what they typed.
			out += escapeText(tag);
			continue;
		}

		if (VOID_TAGS.has(name)) {
			if (!closing) out += `<${name}>`;
			continue;
		}

		if (closing) {
			const depth = stack.findLastIndex((entry) => entry.name === name);
			if (depth === -1) continue; // Stray close.
			// Close anything left open inside it, so the output stays nested.
			for (let i = stack.length - 1; i >= depth; i--) {
				if (stack[i].emitted) out += `</${stack[i].name}>`;
			}
			stack.length = depth;
			continue;
		}

		const rendered = openTag(name, parseAttributes(rawAttributes ?? ''));
		if (rendered) out += rendered;
		stack.push({ name, emitted: rendered !== null });
	}

	if (!skipUntil) out += escapeText(html.slice(cursor));
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].emitted) out += `</${stack[i].name}>`;
	}
	return out;
}
