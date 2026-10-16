import { describe, expect, test } from 'vitest';

import type { SafetyFlag } from '$lib/api';

import { flagReason, flagSummary } from './flags';

const flag = (fields: Partial<SafetyFlag> = {}): SafetyFlag => ({
	decision: 'self_harm',
	action: 'end_interview',
	...fields
});

describe('flagReason', () => {
	test("a respondent report's reason is its own", () => {
		expect(flagReason({ reason: 'offensive', safety: null })).toBe('offensive');
	});

	test('a safety flag reads its decision as words', () => {
		expect(flagReason({ reason: null, safety: flag() })).toBe('self harm');
	});
});

describe('flagSummary', () => {
	test('says what the check did', () => {
		expect(flagSummary(flag())).toBe('The safety check ended the interview.');
	});

	test('says when the respondent may still override it', () => {
		expect(flagSummary(flag({ respondent_override: true }))).toBe(
			'The safety check ended the interview, unless the respondent overrode it.'
		);
	});

	test('says when the respondent overrode it', () => {
		expect(
			flagSummary(flag({ action: 'skip_probes', respondent_override: true, override: 'override' }))
		).toBe(
			'The safety check skipped the remaining probes, but the respondent overrode it and continued.'
		);
	});

	test('says when the respondent accepted it', () => {
		expect(flagSummary(flag({ respondent_override: true, override: 'accept' }))).toBe(
			'The safety check ended the interview; the respondent accepted.'
		);
	});
});
