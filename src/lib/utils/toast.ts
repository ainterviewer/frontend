import { toast } from 'svelte-sonner';

import { errorReason } from './errors';

/**
 * Report a failed SDK call: `title` says what failed, and `errorReason`,
 * when the backend gave one, says why.
 *
 * A fetch that never got a response is already reported by the toast
 * interceptor, and one the app cancelled itself is not news, so neither is
 * toasted a second time here.
 */
export function toastApiError(error: unknown, title: string): void {
	console.error(title, error);
	if (error instanceof TypeError) return;
	if (error instanceof DOMException && error.name === 'AbortError') return;
	toast.error(title, { description: errorReason(error) });
}
