import { toast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkError } from './errors';
import { toastApiError } from './toast';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

describe('toastApiError', () => {
	beforeEach(() => {
		vi.mocked(toast.error).mockClear();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('says what failed, and why when the backend said', () => {
		toastApiError({ detail: 'Folder is not empty', code: null }, 'Failed to delete folder');
		expect(toast.error).toHaveBeenCalledWith('Failed to delete folder', {
			description: 'Folder is not empty'
		});
	});

	it('falls back to the first validation message of a 422', () => {
		const validation = { detail: [{ loc: ['body', 'alias'], msg: 'bad alias', type: 'value' }] };
		toastApiError(validation, 'Failed to save');
		expect(toast.error).toHaveBeenCalledWith('Failed to save', { description: 'bad alias' });
	});

	it.each([
		['a plain-text body', 'Bad Gateway'],
		['nothing', undefined]
	])('says only what failed for %s', (_label, error) => {
		toastApiError(error, 'Failed to save');
		expect(toast.error).toHaveBeenCalledWith('Failed to save', { description: undefined });
	});

	it("reports a bug's TypeError, which the interceptor never saw", () => {
		toastApiError(new TypeError("Cannot read properties of undefined (reading 'id')"), 'Failed');
		expect(toast.error).toHaveBeenCalledWith('Failed', { description: undefined });
	});

	it.each([
		['a network failure', new NetworkError(new TypeError('Failed to fetch'))],
		['a cancelled request', new DOMException('aborted', 'AbortError')]
	])('leaves %s to the interceptor', (_label, error) => {
		toastApiError(error, 'Failed to save');
		expect(toast.error).not.toHaveBeenCalled();
	});
});
