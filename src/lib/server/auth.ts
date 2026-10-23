import { getRequestEvent } from '$app/server';

/**
 * The access token of the request being served, for the API client's `auth`
 * option: the client asks for it on every call to an operation whose OpenAPI
 * declares `access_token` cookie security, and sends it as that cookie.
 *
 * Read per call rather than set once, because the client is one module-wide
 * object serving every user's requests at once. A token in its `headers`
 * config would go out with the next user's requests too; this reads the
 * current request's own cookies, which SvelteKit tracks across `await`s.
 *
 * Only `access_token`, never the whole jar: the refresh token stays with the
 * hooks that refresh it, and the backend reads nothing else from the server.
 * After a refresh in `handle`, `cookies.get` returns the new token.
 *
 * Outside a request -- at start-up, in a timer -- there is no user, so no
 * token: the call goes out unauthenticated and the backend refuses it.
 */
export function currentAccessToken(): string | undefined {
	let event;
	try {
		event = getRequestEvent();
	} catch {
		return undefined;
	}
	return event.cookies.get('access_token');
}
