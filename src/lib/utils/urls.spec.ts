import { describe, expect, it } from 'vitest';

import { loginNext, loginUrl, portableSubRoute } from './urls';

const ROOT = '/dashboard/projects/[project_id]/[lang]';

describe('portableSubRoute', () => {
	it('keeps a fully static sub-route', () => {
		expect(
			portableSubRoute('/dashboard/projects/abc/en/analysis/codebook', `${ROOT}/analysis/codebook`)
		).toBe('analysis/codebook');
	});

	it('is empty on the project root', () => {
		expect(portableSubRoute('/dashboard/projects/abc/en', ROOT)).toBe('');
	});

	it('stops at a dynamic segment', () => {
		expect(
			portableSubRoute(
				'/dashboard/projects/abc/en/interviews/xyz',
				`${ROOT}/interviews/[interview_id]`
			)
		).toBe('interviews');
	});

	it('drops everything below a dynamic segment', () => {
		expect(
			portableSubRoute(
				'/dashboard/projects/abc/en/tests/simulations/t1/runs',
				`${ROOT}/tests/simulations/[test_id]/runs`
			)
		).toBe('tests/simulations');
	});

	it('is empty without a route id or outside a project', () => {
		expect(portableSubRoute('/dashboard/projects/abc/en/setup', null)).toBe('');
		expect(portableSubRoute('/dashboard/settings/profile', '/dashboard/settings/profile')).toBe('');
	});
});

describe('loginNext', () => {
	it('returns to a dashboard page with its query', () => {
		expect(loginNext('/dashboard/invites/accept?token=abc')).toBe(
			'/dashboard/invites/accept?token=abc'
		);
	});

	it('falls back to the dashboard', () => {
		for (const next of [null, '', '/login', '//evil.example', '/dashboardx', '/dashboard/\\evil']) {
			expect(loginNext(next)).toBe('/dashboard');
		}
	});

	it('round-trips through loginUrl', () => {
		const url = new URL('https://app.example/dashboard/invites/accept?token=a%2Bb');
		const next = new URL(loginUrl(url), url).searchParams.get('next');
		expect(loginNext(next)).toBe('/dashboard/invites/accept?token=a%2Bb');
	});
});
