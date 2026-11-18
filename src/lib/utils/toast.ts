import { type ExternalToast, toast } from 'svelte-sonner';

import { errorReason, NetworkError } from './errors';

/**
 * Report a failed SDK call: `title` says what failed, and `errorReason`,
 * when the backend gave one, says why.
 *
 * A fetch that never got a response is already reported by the toast
 * interceptor, and one the app cancelled itself is not news, so neither is
 * toasted a second time here.
 *
 * `options` go to the toast as they are; `duration: Infinity` keeps one open
 * until it is dismissed, for a failure that must not slip past unseen.
 */
export function toastApiError(error: unknown, title: string, options?: ExternalToast): void {
	console.error(title, error);
	if (error instanceof NetworkError) return;
	if (error instanceof DOMException && error.name === 'AbortError') return;
	toast.error(title, { description: errorReason(error), ...options });
}
