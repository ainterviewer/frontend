import { describe, expect, it } from 'vitest';
import { sanitizeMarkup } from './sanitize';

describe('sanitizeMarkup', () => {
	it('keeps an allowlisted link and hardens its target', () => {
		expect(sanitizeMarkup('se <a href="https://kunet.ku.dk/x">på KUnet</a>.')).toBe(
			'se <a href="https://kunet.ku.dk/x" target="_blank" rel="noopener noreferrer nofollow">på KUnet</a>.'
		);
	});

	it('keeps inline formatting and drops its attributes', () => {
		expect(sanitizeMarkup('<b onclick="x()">bold</b> and <em>emphasis</em><br>next')).toBe(
			'<b>bold</b> and <em>emphasis</em><br>next'
		);
	});

	it('escapes tags outside the allowlist instead of dropping their content', () => {
		expect(sanitizeMarkup('<div>text</div>')).toBe('&lt;div&gt;text&lt;/div&gt;');
		expect(sanitizeMarkup('<img src=x onerror=alert(1)>')).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
	});

	it('drops script and style along with their content', () => {
		expect(sanitizeMarkup('a<script>alert(1)</script>b')).toBe('ab');
		expect(sanitizeMarkup('a<style>body{}</style>b')).toBe('ab');
	});

	it('unwraps anchors whose href is not safe to follow', () => {
		expect(sanitizeMarkup('<a href="javascript:alert(1)">click</a>')).toBe('click');
		expect(sanitizeMarkup('<a href="&#106;avascript:alert(1)">click</a>')).toBe('click');
		expect(sanitizeMarkup('<a href="java&#9;script:alert(1)">click</a>')).toBe('click');
		expect(sanitizeMarkup('<a href="data:text/html,x">click</a>')).toBe('click');
	});

	it('allows relative, fragment and mailto targets', () => {
		for (const href of ['/help', '#top', 'mailto:hr@adm.ku.dk', 'kunet.ku.dk/x']) {
			expect(sanitizeMarkup(`<a href="${href}">l</a>`)).toContain(`href="${href}"`);
		}
	});

	it('balances stray and unclosed tags', () => {
		expect(sanitizeMarkup('</b>text')).toBe('text');
		expect(sanitizeMarkup('<b>text')).toBe('<b>text</b>');
		expect(sanitizeMarkup('<b><em>text</b>')).toBe('<b><em>text</em></b>');
		// The anchor was unwrapped, so its close must go with it.
		expect(sanitizeMarkup('<a href="javascript:x">a</a>b')).toBe('ab');
	});

	it('escapes bare ampersands but leaves character references alone', () => {
		expect(sanitizeMarkup('R&D')).toBe('R&amp;D');
		expect(sanitizeMarkup('a &amp; b &#233;')).toBe('a &amp; b &#233;');
	});

	it('returns the empty string for empty input', () => {
		expect(sanitizeMarkup('')).toBe('');
	});
});

describe('sanitizeMarkup with marks', () => {
	const yellow = { className: 'hit', title: 'Matched your search' };

	it('marks text and leaves the markup around it alone', () => {
		// "guidance" is prose; the link keeps its own hardening.
		const text = 'see guidance <a href="https://x.dk/p">here</a>.';
		expect(sanitizeMarkup(text, [{ start: 4, end: 12, ...yellow }])).toBe(
			'see <mark class="hit" title="Matched your search">guidance</mark> ' +
				'<a href="https://x.dk/p" target="_blank" rel="noopener noreferrer nofollow">here</a>.'
		);
	});

	it('marks inside an element without breaking its nesting', () => {
		expect(sanitizeMarkup('<b>stress</b>', [{ start: 3, end: 9, className: 'hit' }])).toBe(
			'<b><mark class="hit">stress</mark></b>'
		);
	});

	it('does not mark a word that only occurs inside a tag', () => {
		// The real case: a keyword scan runs against the raw message, so
		// `stress*` matches "Stressand" in the support-page URL. Nobody said it.
		const text = 'about stress <a href="https://ku.dk/Stressand-how-to.aspx">KUnet</a>';
		const marked = sanitizeMarkup(text, [
			{ start: 6, end: 12, className: 'hit' },
			{ start: 36, end: 45, className: 'hit' }
		]);

		expect(marked).toContain('<mark class="hit">stress</mark>');
		expect(marked).toContain('href="https://ku.dk/Stressand-how-to.aspx"');
		expect(marked.match(/<mark/g)).toHaveLength(1);
	});

	it('marks each half of a range that straddles a tag', () => {
		expect(sanitizeMarkup('stre<b>ss</b>', [{ start: 0, end: 9, className: 'hit' }])).toBe(
			'<mark class="hit">stre</mark><b><mark class="hit">ss</mark></b>'
		);
	});

	it('escapes the class and title it is handed', () => {
		expect(
			sanitizeMarkup('abc', [{ start: 0, end: 3, className: '"><script>', title: 'x"y' }])
		).toBe('<mark class="&quot;&gt;&lt;script&gt;" title="x&quot;y">abc</mark>');
	});

	it('clips a mark to the run it lands in', () => {
		// `<b>` is kept, so the mark cannot span it as one range; the text
		// before it is marked and the element is left whole.
		expect(sanitizeMarkup('a<b>c', [{ start: 0, end: 3, className: 'hit' }])).toBe(
			'<mark class="hit">a</mark><b>c</b>'
		);
	});

	it('does not mark inside a tag it escaped into visible text', () => {
		// `<div>` is shown to the author as characters, but it is still markup,
		// and `match_spans` on the server drops a span landing in it. Marking it
		// here would make the two disagree about what anybody said.
		expect(sanitizeMarkup('<div>x', [{ start: 0, end: 6, className: 'hit' }])).toBe(
			'&lt;div&gt;<mark class="hit">x</mark>'
		);
	});

	it('is unchanged when nothing is marked', () => {
		expect(sanitizeMarkup('<b>text</b>', [])).toBe(sanitizeMarkup('<b>text</b>'));
	});
});
