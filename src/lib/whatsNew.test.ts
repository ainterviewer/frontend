import { describe, expect, it } from 'vitest';

import type { PlatformRelease } from '$lib/api';

import { migrateLastSeen, unseenVersions } from './whatsNew.svelte';

const release = (platform_version: string) =>
	({ platform_version, released_at: '2026-11-20', highlights: [] }) as unknown as PlatformRelease;

const releases = ['2026.11-13', '2026.11-12', '2026.11-11'].map(release);

describe('unseenVersions', () => {
	it('flags the releases above the last seen one', () => {
		expect(unseenVersions(releases, '2026.11-12')).toEqual(['2026.11-13']);
	});

	it('flags nothing when the newest was already seen', () => {
		expect(unseenVersions(releases, '2026.11-13').length).toBe(0);
	});

	it('flags nothing on a first visit', () => {
		expect(unseenVersions(releases, null).length).toBe(0);
	});

	it('flags everything when the last seen release is off the list', () => {
		expect(unseenVersions(releases, '2026.10-01').length).toBe(3);
	});
});

describe('migrateLastSeen', () => {
	it('renames a marker stored before versions were YYYY.MM-NN', () => {
		expect(migrateLastSeen('2026.11.13')).toBe('2026.11-13');
		expect(migrateLastSeen('2026.11.1')).toBe('2026.11-01');
	});

	it('leaves a current marker and a missing one alone', () => {
		expect(migrateLastSeen('2026.12-01')).toBe('2026.12-01');
		expect(migrateLastSeen(null)).toBeNull();
	});
});
