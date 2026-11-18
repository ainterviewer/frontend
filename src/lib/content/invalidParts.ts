import type { ContentError, ContentStatus } from '$lib/api/types.gen';
import type { LivePart } from '$lib/collab/contentSession.svelte';

// While a co-edited part is invalid, the draft holds its last *valid* doc:
// a test would run, a share link hand out, and a publish release the part as
// it was before its problems. So none of them may start until it is fixed.

// In the order the setup lists them, in the sidebar (`projectSidebarItems`).
const PAGE_NAME: Record<LivePart, string> = {
	consent: 'consent',
	welcome: 'welcome page',
	guide: 'interview guide'
};

/** What the setup calls a part's page: "the welcome page". */
export function pageName(part: LivePart): string {
	return PAGE_NAME[part];
}

const PARTS = Object.keys(PAGE_NAME) as LivePart[];

/**
 * The parts that are invalid. `status.doc_errors` are as last saved; `live`
 * has the errors of the parts known more recently -- the page's own part, the
 * parts with a session (`sessionErrors`) -- which win.
 */
export function invalidParts(
	status: Pick<ContentStatus, 'doc_errors'> | null | undefined,
	live: Partial<Record<LivePart, ContentError[]>> = {}
): LivePart[] {
	return PARTS.filter((part) => !!(live[part] ?? status?.doc_errors?.[part])?.length);
}

/** What each action would do with a part as it was before its problems. */
export const WOULD = {
	try: 'a test would run it as it was before them.',
	share: 'a tester would get it as it was before them.',
	publish: 'publishing would release it as it was before them.'
} as const;

/**
 * Why an action may not start while `parts` are invalid, or undefined when
 * none is: "Fix the problems in the interview guide first: …".
 */
export function fixFirst(parts: LivePart[], would: string): string | undefined {
	const names = PARTS.filter((part) => parts.includes(part)).map((part) => PAGE_NAME[part]);
	if (names.length === 0) return undefined;
	const list =
		names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	return `Fix the problems in the ${list} first: ${would}`;
}
