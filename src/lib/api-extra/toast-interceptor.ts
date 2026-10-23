import { toast } from 'svelte-sonner';

import { client } from '../api/client.gen';
import { NetworkError } from '../utils/errors';

// Only a fetch that never got a response is reported here: there is no body
// to say why, and the page cannot tell it from any other failure. Every
// answered error -- a 5xx included -- is reported once, by the page that made
// the call, through `toastApiError`.
client.interceptors.error.use((error, response, _request, _options) => {
	if (typeof window === 'undefined') {
		return error;
	}

	// A request the app cancelled itself -- a filter changed, the page was left
	// -- arrives here looking exactly like a failed fetch, since it never got a
	// response. It is not something to tell the user about.
	if (error instanceof DOMException && error.name === 'AbortError') {
		return error;
	}

	if (!response) {
		// One toast for a burst of requests failing together.
		toast.error('Network error — please check your connection', { id: 'network-error' });
		// Marked as told, so `toastApiError` does not say it again -- unlike a
		// bare TypeError, which may as well be a bug in the caller's own code.
		return new NetworkError(error);
	}

	return error;
});
