import type { Cookies } from '@sveltejs/kit';
import { error, type Handle, redirect } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import { client } from '$lib/api/client.gen';
import { currentAccessToken } from '$lib/server/auth';

const API_BASE = () => env.API_URL || 'http://localhost:8666';

// Configure the API client for server-side requests
// This ensures that calls made from load functions or form actions
// hit the running backend service directly, as there is no browser proxy on the server.
// Each call authenticates as the user whose request is being served; see
// `currentAccessToken`.
client.setConfig({
	baseUrl: API_BASE(),
	auth: currentAccessToken
});

type RefreshResult = 'ok' | 'unauthorized' | 'unavailable';

/**
 * Call the backend /api/refresh endpoint and forward the new cookies
 * to the browser.
 */
async function serverSideRefresh(fetchFn: typeof fetch, cookies: Cookies): Promise<RefreshResult> {
	const refreshToken = cookies.get('refresh_token');
	if (!refreshToken) return 'unauthorized';

	let res: Response;
	try {
		res = await fetchFn(`${API_BASE()}/api/refresh`, {
			method: 'POST',
			headers: { cookie: `refresh_token=${refreshToken}` }
		});
	} catch {
		return 'unavailable';
	}

	if (!res.ok) {
		if (res.status >= 400 && res.status < 500) {
			return 'unauthorized';
		}
		return 'unavailable';
	}

	for (const header of res.headers.getSetCookie()) {
		const [cookiePart, ...attrParts] = header.split(';');
		const eqIndex = cookiePart.indexOf('=');
		const name = cookiePart.slice(0, eqIndex).trim();
		const value = cookiePart.slice(eqIndex + 1).trim();

		const attrs: Record<string, string | boolean> = {};
		for (const attr of attrParts) {
			const [key, ...val] = attr.trim().split('=');
			attrs[key.toLowerCase()] = val.length ? val.join('=') : true;
		}

		// Carried over, or a "remember me" refresh cookie would come back from
		// a server-side refresh as a session cookie, gone when the browser
		// closes.
		const maxAge = typeof attrs['max-age'] === 'string' ? Number(attrs['max-age']) : undefined;
		const expires = typeof attrs.expires === 'string' ? new Date(attrs.expires) : undefined;

		cookies.set(name, value, {
			path: (attrs.path as string) || '/',
			secure: 'secure' in attrs,
			httpOnly: 'httponly' in attrs,
			sameSite: ((attrs.samesite as string) || 'lax') as 'lax' | 'strict' | 'none',
			maxAge,
			expires
		});
	}

	return 'ok';
}

function clearAuthCookies(cookies: Cookies) {
	cookies.delete('access_token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
}

export { clearAuthCookies };

// How long before its expiry a token counts as expired. It still has to reach
// the backend and pass its check there, possibly by a clock a little ahead of
// this one; a token that lapses on the way gets a 401, and the dashboard
// layout takes a 401 for a dead session and logs the user out.
const EXPIRY_MARGIN_MS = 30_000;

function isTokenExpired(token: string): boolean {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return payload.exp * 1000 < Date.now() + EXPIRY_MARGIN_MS;
	} catch {
		return true;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/dashboard')) {
		const accessToken = event.cookies.get('access_token');
		const hasRefresh = event.cookies.get('refresh_token');

		if (!accessToken && !hasRefresh) {
			throw redirect(303, '/login');
		}

		const needsRefresh = !accessToken || isTokenExpired(accessToken);
		if (needsRefresh) {
			if (!hasRefresh) {
				// Token expired and no refresh token — dead session
				clearAuthCookies(event.cookies);
				throw redirect(303, '/login');
			}
			const refreshResult = await serverSideRefresh(event.fetch, event.cookies);
			if (refreshResult === 'unauthorized') {
				clearAuthCookies(event.cookies);
				throw redirect(303, '/login');
			}
			if (refreshResult === 'unavailable') {
				throw error(503, 'Backend unavailable');
			}
			// Successfully refreshed — fall through; the API client reads the
			// new access token from event.cookies.
		}
	}

	// For authenticated interview types, attempt a token refresh if needed.
	// On failure, let the request through — the page will handle authError.
	if (event.url.pathname === '/interview') {
		const interviewType = event.url.searchParams.get('interview_type');
		if (interviewType === 'manual_test' || interviewType === 'synthetic_test') {
			const accessToken = event.cookies.get('access_token');
			const hasRefresh = event.cookies.get('refresh_token');
			const needsRefresh = !accessToken || isTokenExpired(accessToken);

			if (needsRefresh && hasRefresh) {
				const refreshResult = await serverSideRefresh(event.fetch, event.cookies);
				if (refreshResult === 'unavailable') {
					throw error(503, 'Backend unavailable');
				}
				// On unauthorized refresh, let the request through — the page will handle authError.
			}
		}
	}

	return resolve(event);
};
