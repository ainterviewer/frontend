import { describe, expect, it } from 'vitest';

import { LANGS, toLang } from './lang';
import { getUiText, splitWithdraw } from './ui';

describe('toLang', () => {
	it('resolves the dashboard lowercase and interview uppercase codes alike', () => {
		expect(toLang('da')).toBe('DA');
		expect(toLang('DA')).toBe('DA');
	});

	it.each(['JA', '', null, undefined])('falls back to English for %s', (code) => {
		expect(toLang(code)).toBe('EN');
	});
});

describe('welcome notice', () => {
	it.each(LANGS)('has one place for the contact address in %s', (lang) => {
		const { withdraw } = getUiText(lang).welcome;

		expect(withdraw.split('{email}')).toHaveLength(2);
	});

	it('splits around the address', () => {
		expect(splitWithdraw('Contact {email} now')).toEqual(['Contact ', ' now']);
	});
});
