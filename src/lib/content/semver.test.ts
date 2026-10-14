import { describe, expect, it } from 'vitest';

import { allowedBumps, bumped, nextVersion } from './semver';

describe('semver', () => {
	it('bumps each part and zeroes the ones below', () => {
		expect(bumped('1.2.3', 'patch')).toBe('1.2.4');
		expect(bumped('1.2.3', 'minor')).toBe('1.3.0');
		expect(bumped('1.2.3', 'major')).toBe('2.0.0');
		expect(bumped(null, 'patch')).toBe('1.0.0');
	});

	it('only offers bumps at or above the computed one', () => {
		expect(allowedBumps('minor')).toEqual(['minor', 'major']);
		expect(allowedBumps('patch')).toEqual(['patch', 'minor', 'major']);
	});

	it('raises from the version the computed bump would give', () => {
		// Last published 1.2.3; text changed, so the server says 1.2.4.
		expect(nextVersion('1.2.4', 'patch', 'patch')).toBe('1.2.4');
		expect(nextVersion('1.2.4', 'patch', 'minor')).toBe('1.3.0');
		expect(nextVersion('1.2.4', 'patch', 'major')).toBe('2.0.0');
		// A question added: 1.3.0, raised to a major: 2.0.0.
		expect(nextVersion('1.3.0', 'minor', 'major')).toBe('2.0.0');
	});
});
