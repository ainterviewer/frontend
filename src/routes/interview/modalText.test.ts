import { describe, expect, it } from 'vitest';

import { getModalText } from './modalText';

describe('getModalText', () => {
	it.each(['EN', 'DA', 'DE', 'ES', 'FR'])(
		'points %s respondents at the deployment contact',
		(lang) => {
			const { help_text } = getModalText(lang, ['m'], 'privacy@example.org');

			expect(help_text).toContain('href="mailto:privacy@example.org"');
		}
	);

	it('leaves the contact paragraph out without an address', () => {
		const { help_text } = getModalText('EN', ['m'], null);

		expect(help_text).not.toContain('mailto:');
	});
});
