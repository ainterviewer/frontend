import { describe, expect, it } from 'vitest';

import { apiError, errorDetail, hasErrorCode, staleRevision } from './errors';

// Every error the backend answers is `{ detail, code }` but FastAPI's own 422,
// whose `detail` is a list. These read one without tripping over the other.
const expired = { detail: 'Invite token expired', code: 'invite_expired' };
const validation = { detail: [{ loc: ['body', 'email'], msg: 'not an email', type: 'value' }] };

describe('apiError', () => {
	it('reads an ApiError body', () => {
		expect(apiError(expired)).toEqual(expired);
	});

	it.each([
		['a validation error', validation],
		['nothing', undefined],
		['a network failure', new TypeError('Failed to fetch')],
		['a plain-text body', 'Internal Server Error']
	])('is null for %s', (_label, error) => {
		expect(apiError(error)).toBeNull();
	});
});

describe('hasErrorCode', () => {
	it('matches on the code, not the wording', () => {
		expect(hasErrorCode(expired, 'invite_expired')).toBe(true);
		expect(hasErrorCode(expired, 'invite_invalid')).toBe(false);
		expect(hasErrorCode(validation, 'invite_expired')).toBe(false);
	});
});

describe('errorDetail', () => {
	it('shows what the backend said, or the fallback', () => {
		expect(errorDetail(expired, 'fallback')).toBe('Invite token expired');
		expect(errorDetail(validation, 'fallback')).toBe('fallback');
	});
});

describe('staleRevision', () => {
	it('reads the revision to overwrite with', () => {
		const stale = { detail: 'stale', code: 'stale_revision', current_revision: 7, part: 'guide' };
		expect(staleRevision(stale)).toBe(7);
	});

	it('is null for any other error', () => {
		expect(staleRevision(expired)).toBeNull();
		expect(staleRevision(undefined)).toBeNull();
	});
});
