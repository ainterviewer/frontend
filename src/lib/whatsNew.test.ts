import { describe, expect, it } from 'vitest';

import type { PlatformRelease } from '$lib/api';

import { unseenVersions } from './whatsNew.svelte';

const release = (platform_version: string) =>
	({ platform_version, released_at: '2026-11-20', highlights: [] }) as unknown as PlatformRelease;

const releases = ['2026.11.13', '2026.11.12', '2026.11.11'].map(release);

describe('unseenVersions', () => {
	it('flags the releases above the last seen one', () => {
		expect(unseenVersions(releases, '2026.11.12')).toEqual(['2026.11.13']);
	});

	it('flags nothing when the newest was already seen', () => {
		expect(unseenVersions(releases, '2026.11.13').length).toBe(0);
	});

	it('flags nothing on a first visit', () => {
		expect(unseenVersions(releases, null).length).toBe(0);
	});

	it('flags everything when the last seen release is off the list', () => {
		expect(unseenVersions(releases, '2026.10.1').length).toBe(3);
	});
});
