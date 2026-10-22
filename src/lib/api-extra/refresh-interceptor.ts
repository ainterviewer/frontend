import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { Auth } from '../api';
import { client } from '../api/client.gen';
import { hasErrorCode } from '../utils/errors';

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

// The backend's 403 when the access token says preview features are off
// carries code `preview_features_required`. The claim is only re-read from the
// database on refresh, so after an admin enables the flag the token is stale
// for up to one access-token lifetime -- while /me, which the UI gates on,
// already says yes. A refresh fixes it.
async function isStalePreviewFeatures(response: Response): Promise<boolean> {
	if (response.status !== 403) return false;
	try {
		return hasErrorCode(await response.clone().json(), 'preview_features_required');
	} catch {
		return false;
	}
}

function refreshOnce(): Promise<boolean> {
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
	return refreshPromise;
}

client.interceptors.response.use(async (response, request, _options) => {
	if (typeof window === 'undefined') {
		return response;
	}

	if (response.status !== 401) {
		// Refresh and replay once. The replay goes through plain fetch, so a
		// second refusal -- the flag really is off -- is returned as is rather
		// than looping.
		if (!(await isStalePreviewFeatures(response))) {
			return response;
		}
		const ok = await refreshOnce();
		const clone = pendingClones.get(request);
		pendingClones.delete(request);
		return ok && clone ? fetch(clone) : response;
	}

	// Don't retry refresh/login endpoints to avoid loops
	const url = new URL(request.url);
	if (url.pathname === '/api/refresh' || url.pathname === '/api/login') {
		await goto(resolve('/login'));
		return response;
	}

	const ok = await refreshOnce();
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
