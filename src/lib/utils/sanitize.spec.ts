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
