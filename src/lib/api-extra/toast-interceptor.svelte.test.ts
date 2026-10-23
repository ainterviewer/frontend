import './toast-interceptor';

import { toast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Default } from '$lib/api';
import { NetworkError } from '$lib/utils/errors';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

// In the browser project, since the interceptor stands aside on the server.
describe('the toast interceptor', () => {
	beforeEach(() => {
		vi.mocked(toast.error).mockClear();
	});

	it('reports a request that got no response, and marks it as told', async () => {
		const failure = new TypeError('Failed to fetch');
		const { error } = await Default.getLanguages({ fetch: () => Promise.reject(failure) });

		expect(error).toBeInstanceOf(NetworkError);
		expect(error).toMatchObject({ cause: failure });
		expect(toast.error).toHaveBeenCalledWith(expect.any(String), { id: 'network-error' });
	});

	it('leaves a cancelled request alone', async () => {
		const abort = new DOMException('aborted', 'AbortError');
		const { error } = await Default.getLanguages({ fetch: () => Promise.reject(abort) });

		expect(error).toBe(abort);
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('leaves an answered error to the page', async () => {
		const answered = new Response(JSON.stringify({ detail: 'Nope', code: null }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
		const { error } = await Default.getLanguages({ fetch: () => Promise.resolve(answered) });

		expect(error).toEqual({ detail: 'Nope', code: null });
		expect(toast.error).not.toHaveBeenCalled();
	});
});
