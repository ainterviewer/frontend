import { describe, expect, it } from 'vitest';

import type { ProjectLanguage } from '$lib/api';

import { defaultLanguage, offeredLanguage } from './languages';

const language = (code: string, is_default = false): ProjectLanguage => ({
	code,
	name: code,
	is_default,
	in_progress: false
});

const languages = [language('EN'), language('DA', true)];

describe('defaultLanguage', () => {
	it('is the default, else the first, else none', () => {
		expect(defaultLanguage(languages)).toBe('DA');
		expect(defaultLanguage([language('EN'), language('DA')])).toBe('EN');
		expect(defaultLanguage([])).toBeUndefined();
	});
});

describe('offeredLanguage', () => {
	it('keeps a language the project offers', () => {
		expect(offeredLanguage(languages, 'EN')).toBe('EN');
	});

	it('corrects the case of one it offers', () => {
		expect(offeredLanguage(languages, 'en')).toBe('EN');
	});

	it('falls back to the default for one it does not offer', () => {
		expect(offeredLanguage(languages, 'FR')).toBe('DA');
	});

	it('has nothing to offer without languages', () => {
		expect(offeredLanguage([], 'EN')).toBeUndefined();
	});
});
