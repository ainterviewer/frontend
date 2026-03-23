import { env } from '$env/dynamic/private';
import { client } from '$lib/api/client.gen';
import { redirect, type Handle } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';

const API_BASE = () => env.API_URL || 'http://localhost:8666';

// Configure the API client for server-side requests
// This ensures that calls made from load functions or form actions
// hit the running backend service directly, as there is no browser proxy on the server.
client.setConfig({
	baseUrl: API_BASE()
});

/**
 * Call the backend /api/refresh endpoint and forward the new cookies
 * to the browser. Returns true if the refresh succeeded.
 */
async function serverSideRefresh(cookies: Cookies): Promise<boolean> {
	const refreshToken = cookies.get('refresh_token');
	if (!refreshToken) return false;

	const res = await fetch(`${API_BASE()}/api/refresh`, {
		method: 'POST',
		headers: { cookie: `refresh_token=${refreshToken}` }
	});

	if (!res.ok) return false;

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

		cookies.set(name, value, {
			path: (attrs.path as string) || '/',
			secure: 'secure' in attrs,
			httpOnly: 'httponly' in attrs,
			sameSite: ((attrs.samesite as string) || 'lax') as 'lax' | 'strict' | 'none'
		});
	}

	return true;
}

function clearAuthCookies(cookies: Cookies) {
	cookies.delete('access_token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
}

export { clearAuthCookies };

function isTokenExpired(token: string): boolean {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return payload.exp * 1000 < Date.now();
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

		// access_token missing or expired — try to refresh then redirect
		// so all load functions see fresh cookies in request headers
		const needsRefresh = !accessToken || isTokenExpired(accessToken);
		if (needsRefresh && hasRefresh) {
			const ok = await serverSideRefresh(event.cookies);
			if (!ok) {
				clearAuthCookies(event.cookies);
				throw redirect(303, '/login');
			}
			throw redirect(303, event.url.pathname + event.url.search);
		}

		// Token present but expired and no refresh token — dead session
		if (needsRefresh) {
			clearAuthCookies(event.cookies);
			throw redirect(303, '/login');
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
				const ok = await serverSideRefresh(event.cookies);
				if (ok) {
					throw redirect(303, event.url.pathname + event.url.search);
				}
			}
		}
	}

	return resolve(event);
};
