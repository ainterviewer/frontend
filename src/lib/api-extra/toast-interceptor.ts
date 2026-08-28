import { toast } from 'svelte-sonner';
import { client } from '../api/client.gen';

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
		// Network error / fetch failed
		toast.error('Network error — please check your connection');
		return error;
	}

	if (response.status >= 500) {
		toast.error('Something went wrong — please try again');
	}

	return error;
});
