export function parseProjectRoute(pathname: string) {
	const parts = pathname.split('/');
	const projectsIndex = parts.indexOf('projects');
	let projectId: string | undefined;
	let languageCode: string | undefined;

	if (projectsIndex > -1 && parts.length > projectsIndex + 1) {
		projectId = parts[projectsIndex + 1];

		const nextPart = parts[projectsIndex + 2];
		if (nextPart && nextPart.length === 2) {
			languageCode = nextPart;
		}
	}

	return { projectId, languageCode };
}

/**
 * The part of the current path below `/projects/<id>/<lang>` that is safe to
 * carry over to another project or language — everything up to the first
 * dynamic segment. `.../interviews/<interview_id>` keeps `interviews`, because
 * that interview does not exist in the project you are switching to, while
 * `.../analysis/codebook` is kept whole.
 *
 * Needs the matched route id (`page.route.id`) to tell a dynamic segment from a
 * static one; without it nothing is portable.
 */
export function portableSubRoute(pathname: string, routeId: string | null | undefined) {
	if (!routeId) return '';

	const routeParts = routeId.split('/').filter(Boolean);
	const langIndex = routeParts.indexOf('[lang]');
	if (langIndex === -1) return '';

	const parts = pathname.split('/').filter(Boolean);
	const projectsIndex = parts.indexOf('projects');
	if (projectsIndex === -1) return '';

	const routeTail = routeParts.slice(langIndex + 1);
	const tail = parts.slice(projectsIndex + 2 + 1);

	const kept: string[] = [];
	for (let i = 0; i < tail.length; i++) {
		if (!routeTail[i] || routeTail[i].startsWith('[')) break;
		kept.push(tail[i]);
	}
	return kept.join('/');
}

/**
 * Where to send someone after they sign in: the dashboard page they were on
 * when their session ran out (`/login?next=...`), or the dashboard itself.
 * Anything outside `/dashboard` falls back to it, so a crafted link cannot use
 * the login page to redirect to another site (`//evil.example`, `/\evil`).
 */
export function loginNext(next: string | null | undefined): string {
	if (next && /^\/dashboard(?:[/?#]|$)/.test(next) && !next.includes('\\')) return next;
	return '/dashboard';
}

/** The login page, carrying where to return to afterwards. */
export function loginUrl(url: URL): string {
	return `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
}
