import { AsyncLocalStorage } from 'node:async_hooks';

import type { RequestEvent } from '@sveltejs/kit';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Auth, Default } from '$lib/api';
import { client } from '$lib/api/client.gen';

import { currentAccessToken } from './auth';

// Stands in for SvelteKit's own request store, which is an AsyncLocalStorage
// too: what is under test is that each call reads the request it runs in.
const requests = new AsyncLocalStorage<RequestEvent>();

vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		const event = requests.getStore();
		if (!event) throw new Error('Can only read the current request event inside handle');
		return event;
	}
}));

function inRequest<T>(jar: Record<string, string>, fn: () => Promise<T>): Promise<T> {
	const cookies = { get: (name: string) => jar[name] } as RequestEvent['cookies'];
	return requests.run({ cookies } as RequestEvent, fn);
}

/** The Cookie header each call sent, by way of a fetch that answers 200. */
const sent: (string | null)[] = [];
const fetch: typeof globalThis.fetch = async (input) => {
	sent.push(input instanceof Request ? input.headers.get('cookie') : null);
	return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the API client on the server', () => {
	beforeAll(() => {
		client.setConfig({ baseUrl: 'http://backend.test', auth: currentAccessToken });
	});

	it("sends each overlapping request's own token", async () => {
		sent.length = 0;
		await Promise.all([
			inRequest({ access_token: 'alice' }, async () => {
				await tick();
				await Auth.me({ fetch });
			}),
			inRequest({ access_token: 'bob' }, async () => {
				await Auth.me({ fetch });
				await tick();
				await Auth.me({ fetch });
			})
		]);
		expect(sent.sort()).toEqual(['access_token=alice', 'access_token=bob', 'access_token=bob']);
	});

	it('sends only the access token, never the refresh token', async () => {
		sent.length = 0;
		await inRequest({ access_token: 'alice', refresh_token: 'secret' }, () => Auth.me({ fetch }));
		expect(sent).toEqual(['access_token=alice']);
	});

	it('sends no cookie outside a request', async () => {
		sent.length = 0;
		await Auth.me({ fetch });
		expect(sent).toEqual([null]);
	});

	it('sends no cookie for a request without a token', async () => {
		sent.length = 0;
		await inRequest({ refresh_token: 'secret' }, () => Auth.me({ fetch }));
		expect(sent).toEqual([null]);
	});

	it('sends no cookie to an operation that needs no auth', async () => {
		sent.length = 0;
		await inRequest({ access_token: 'alice' }, () => Default.version({ fetch }));
		expect(sent).toEqual([null]);
	});

	it('leaves a cookie the call set itself alone', async () => {
		sent.length = 0;
		await inRequest({ access_token: 'alice' }, () =>
			Auth.me({ fetch, headers: { cookie: 'access_token=explicit' } })
		);
		expect(sent).toEqual(['access_token=explicit']);
	});
});
