import { describe, expect, it } from 'vitest';

import { renderAssistantMarkdown } from './markdown';

describe('renderAssistantMarkdown', () => {
	it('renders emphasis and lists', () => {
		const html = renderAssistantMarkdown('1. **Who** are you?\n2. *Why*?');
		expect(html).toContain('<ol>');
		expect(html).toContain('<strong>Who</strong>');
		expect(html).toContain('<em>Why</em>');
	});

	it('shows raw HTML as text', () => {
		const html = renderAssistantMarkdown('Hi <img src=x onerror=alert(1)> <b>there</b>');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('<b>');
		expect(html).toContain('&lt;img');
	});

	it('escapes HTML in text and code', () => {
		const html = renderAssistantMarkdown('`<script>` and a < b');
		expect(html).not.toContain('<script>');
	});

	it('drops unsafe link targets but keeps the label', () => {
		const html = renderAssistantMarkdown('[click](javascript:alert(1)) [rel](/admin)');
		expect(html).not.toContain('<a');
		expect(html).toContain('click');
		expect(html).toContain('rel');
	});

	it('opens safe links in a new tab', () => {
		const html = renderAssistantMarkdown('[docs](https://example.com/a?b="c")');
		expect(html).toContain('href="https://example.com/a?b=%22c%22"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer nofollow"');
	});

	it('reduces images to their alt text', () => {
		const html = renderAssistantMarkdown('![a chart](https://example.com/x.png)');
		expect(html).not.toContain('<img');
		expect(html).toContain('a chart');
	});
});
