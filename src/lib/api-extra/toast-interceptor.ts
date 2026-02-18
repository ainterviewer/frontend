import { toast } from 'svelte-sonner';
import { client } from '../api/client.gen';

client.interceptors.error.use((error, response, _request, _options) => {
	if (typeof window === 'undefined') {
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
