import { toast } from 'svelte-sonner';

import { apiError } from './errors';

/**
 * Report a failed SDK call: `title` says what failed, and the backend's
 * reason, when it gave one, says why.
 *
 * A fetch that never got a response is already reported by the toast
 * interceptor, and one the app cancelled itself is not news, so neither is
 * toasted a second time here.
 */
export function toastApiError(error: unknown, title: string): void {
	console.error(title, error);
	if (error instanceof TypeError) return;
	if (error instanceof DOMException && error.name === 'AbortError') return;
	toast.error(title, { description: reason(error) });
}

/**
 * The `detail` of an `ApiError`, or else the first message of FastAPI's 422,
 * whose `detail` is a list of validation errors -- an alias in the wrong
 * shape, say.
 */
function reason(error: unknown): string | undefined {
	const body = apiError(error);
	if (body) return body.detail;
	const detail = (error as { detail?: unknown } | null)?.detail;
	if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
	return undefined;
}
