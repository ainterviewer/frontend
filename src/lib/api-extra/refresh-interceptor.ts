import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { Auth } from '../api';
import { client } from '../api/client.gen';

let refreshPromise: Promise<boolean> | null = null;

// Save a clone of every outgoing request so we can replay it after a token refresh.
// The original Request body is consumed by fetch(), making it unusable for retries.
const pendingClones = new WeakMap<Request, Request>();

client.interceptors.request.use((request) => {
	if (typeof window !== 'undefined') {
		pendingClones.set(request, request.clone());
	}
	return request;
});

client.interceptors.response.use(async (response, request, _options) => {
	if (typeof window === 'undefined' || response.status !== 401) {
		return response;
	}

	// Don't retry refresh/login endpoints to avoid loops
	const url = new URL(request.url);
	if (url.pathname === '/api/refresh' || url.pathname === '/api/login') {
		await goto(resolve('/login'));
		return response;
	}

	// Serialize concurrent refresh calls — if one is in-flight, wait for it.
	// Two simultaneous refresh calls would trigger the backend's reuse detection
	// and revoke the entire token family.
	if (!refreshPromise) {
		refreshPromise = Auth.refresh()
			.then((res) => {
				if (res.error) throw res.error;
				return true;
			})
			.catch(() => false)
			.finally(() => {
				refreshPromise = null;
			});
	}

	const ok = await refreshPromise;
	if (!ok) {
		await goto(resolve('/login'));
		return response;
	}

	// Retry with the cloned request — cookies are already updated by the browser
	const clone = pendingClones.get(request);
	pendingClones.delete(request);
	if (!clone) {
		return response;
	}
	return fetch(clone);
});
