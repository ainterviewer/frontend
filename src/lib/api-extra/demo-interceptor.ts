import { navigating } from '$app/state';

import { client } from '../api/client.gen';
import { isDemoRestricted } from '../utils/errors';

/**
 * The project sections demo accounts may not use. Each has a layout that
 * shows them `DemoRestrictionOverlay` over the page, and the backend refuses
 * them the section's routes with a 403 `demo_restricted`.
 */
const DEMO_RESTRICTED_SECTIONS = new Set(['analysis', 'distribution', 'interviews']);

/** Whether `pathname` is in one of those sections:
 * `/dashboard/projects/{project_id}/{lang}/{section}/…`. */
export function inDemoRestrictedSection(pathname: string): boolean {
	const [dashboard, projects, , , section] = pathname.split('/').slice(1);
	return (
		dashboard === 'dashboard' && projects === 'projects' && DEMO_RESTRICTED_SECTIONS.has(section)
	);
}

/**
 * A response that never arrives: the request's caller keeps waiting, so the
 * page stays on its skeletons. It rejects with an `AbortError` when the
 * request is aborted, as a real fetch would, so a page that cancels its
 * requests on teardown still cleans up -- and `toast-interceptor` says
 * nothing about an abort.
 */
function held(signal: AbortSignal): Promise<Response> {
	return new Promise((_, reject) => {
		const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
	});
}

// A demo account sees the restricted sections behind an overlay, the page
// mounted beneath it. Its requests are refused, and every page would show
// that as an error; holding the refusal instead leaves each page on its own
// loading state, without any page knowing about demo accounts.
//
// Matched on the backend's code rather than a list of endpoints, so what is
// held is exactly what the backend refuses. Only within those sections:
// elsewhere a refusal is an error like any other, so a button cannot spin
// forever.
//
// A `load` in these sections must therefore never await a request the
// backend refuses demo accounts -- navigation would wait on it forever.
// Return the promise for the page to apply, as explore and report do.
client.interceptors.response.use(async (response, request) => {
	if (typeof window === 'undefined' || response.status !== 403) {
		return response;
	}
	// Mid-navigation, the page being navigated to is the one that asked.
	const pathname = navigating.to?.url.pathname ?? window.location.pathname;
	if (!inDemoRestrictedSection(pathname)) {
		return response;
	}
	try {
		if (!isDemoRestricted(await response.clone().json())) {
			return response;
		}
	} catch {
		return response;
	}
	return held(request.signal);
});
