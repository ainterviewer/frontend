import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Default } from '$lib/api';

import { inDemoRestrictedSection } from './demo-interceptor';

// The page being navigated to stands in for the address bar, which a test
// cannot move.
const state = vi.hoisted(() => ({ navigating: { to: null as { url: URL } | null } }));
vi.mock('$app/state', () => state);

function navigatingTo(pathname: string) {
	state.navigating.to = { url: new URL(pathname, 'http://localhost') };
}

function refusal(code: string | null) {
	return () =>
		Promise.resolve(
			new Response(JSON.stringify({ detail: 'Refused', code }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			})
		);
}

/** Whether the request is still waiting after the event loop has had a turn. */
async function pending(request: Promise<unknown>): Promise<boolean> {
	const marker = Symbol();
	const winner = await Promise.race([
		request,
		new Promise((resolve) => setTimeout(() => resolve(marker), 20))
	]);
	return winner === marker;
}

const ANALYSIS = '/dashboard/projects/p1/EN/analysis/explore';
const TEST_RESULTS = '/dashboard/projects/p1/EN/tests/results';

describe('the restricted sections', () => {
	it('are analysis, distribution and interviews, at any depth', () => {
		expect(inDemoRestrictedSection(ANALYSIS)).toBe(true);
		expect(inDemoRestrictedSection('/dashboard/projects/p1/EN/distribution')).toBe(true);
		expect(inDemoRestrictedSection('/dashboard/projects/p1/EN/distribution/email')).toBe(true);
		expect(inDemoRestrictedSection('/dashboard/projects/p1/EN/interviews/i1')).toBe(true);
	});

	it('are nothing else', () => {
		expect(inDemoRestrictedSection(TEST_RESULTS)).toBe(false);
		expect(inDemoRestrictedSection('/dashboard/projects/p1/EN')).toBe(false);
		expect(inDemoRestrictedSection('/analysis')).toBe(false);
	});
});

// In the browser project, since the interceptor stands aside on the server.
describe('the demo interceptor', () => {
	beforeEach(() => {
		state.navigating.to = null;
	});

	it('holds a demo refusal in a restricted section', async () => {
		navigatingTo(ANALYSIS);
		const request = Default.getLanguages({ fetch: refusal('demo_restricted') });

		expect(await pending(request)).toBe(true);
	});

	it('lets a held request go when it is aborted', async () => {
		navigatingTo(ANALYSIS);
		const controller = new AbortController();
		const request = Default.getLanguages({
			fetch: refusal('demo_restricted'),
			signal: controller.signal
		});
		await pending(request);

		controller.abort();
		const { error } = await request;

		expect(error).toMatchObject({ name: 'AbortError' });
	});

	it('answers a demo refusal outside the restricted sections', async () => {
		navigatingTo(TEST_RESULTS);
		const { error } = await Default.getLanguages({ fetch: refusal('demo_restricted') });

		expect(error).toEqual({ detail: 'Refused', code: 'demo_restricted' });
	});

	it('answers any other refusal', async () => {
		navigatingTo(ANALYSIS);
		const { error } = await Default.getLanguages({ fetch: refusal(null) });

		expect(error).toEqual({ detail: 'Refused', code: null });
	});
});
