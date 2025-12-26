import { env } from '$env/dynamic/private';
import { client } from '$lib/api/client.gen';
import { redirect, type Handle } from '@sveltejs/kit';

// Configure the API client for server-side requests
// This ensures that calls made from load functions or form actions
// hit the running backend service directly, as there is no browser proxy on the server.
client.setConfig({
	// TODO: Add auth here, or as a middleware to also implement token refresh and error handling
	baseUrl: env.API_URL || 'http://localhost:8666'
});

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/dashboard')) {
		if (!event.cookies.get('token')) {
			throw redirect(303, '/login');
		}
	}
	return resolve(event);
};
