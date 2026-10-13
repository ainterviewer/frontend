import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDate, formatDateFull, formatDay, formatRelative, formatTime } from './datetime';

// The API sends Copenhagen time with its offset; read from New York, the same
// instant is six hours earlier. A formatter that ignored the offset would
// print 07:01 here.
const SENT = '2026-08-21T07:01:00+02:00';

describe('formatting in the reader’s zone', () => {
	const zone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'America/New_York';
	});
	afterAll(() => {
		process.env.TZ = zone;
	});

	it('honours the offset the API sends', () => {
		expect(formatTime(SENT)).toBe('01:01');
		expect(formatDate(SENT)).toBe('21/08/2026 · 01:01');
		expect(formatDateFull(SENT)).toBe('21/08/2026, 01:01:00');
	});

	it('spells a day in three lengths', () => {
		expect(formatDay(SENT)).toBe('21/08/2026');
		expect(formatDay(SENT, 'medium')).toBe('21 Aug 2026');
		expect(formatDay(SENT, 'long')).toBe('21 August 2026');
	});

	it('gives nothing for a missing or unreadable value', () => {
		expect(formatDate(null)).toBe('');
		expect(formatTime(undefined)).toBe('');
		expect(formatDay('not a date')).toBe('');
	});

	it('is relative for a day, absolute after', () => {
		const now = new Date(SENT).getTime();
		expect(formatRelative(SENT, now + 30_000)).toBe('just now');
		expect(formatRelative(SENT, now + 5 * 60_000)).toBe('5 min ago');
		expect(formatRelative(SENT, now + 3 * 3_600_000)).toBe('3 h ago');
		expect(formatRelative(SENT, now + 2 * 86_400_000)).toBe('21 Aug, 01:01');
	});
});
