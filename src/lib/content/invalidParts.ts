import type { ContentError, ContentStatus } from '$lib/api/types.gen';
import type { LivePart } from '$lib/collab/contentSession.svelte';

// While a co-edited part is invalid, the draft holds its last *valid* doc:
// a test would run, a share link hand out, and a publish release the part as
// it was before its problems. So none of them may start until it is fixed.
//
// Except for what the draft can be saved without (errors that are
// `skipped`): questions with no text yet, and the welcome page's contact box
// while its email is missing or not one. Tests run on the rest, and only
// publishing waits on them.

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
 * Each part's errors. `status.doc_errors` are as last saved; `live` has the
 * errors of the parts known more recently -- the page's own part, the parts
 * with a session (`sessionErrors`) -- which win.
 */
export function partErrors(
	status: Pick<ContentStatus, 'doc_errors'> | null | undefined,
	live: Partial<Record<LivePart, ContentError[]>> = {}
): Record<LivePart, ContentError[]> {
	return Object.fromEntries(
		PARTS.map((part) => [part, live[part] ?? status?.doc_errors?.[part] ?? []])
	) as Record<LivePart, ContentError[]>;
}

/** Whether an error keeps its part from being saved: all but `skipped` do. */
export function isBlocking(error: ContentError): boolean {
	return !error.skipped;
}

/** The parts that are invalid: whose errors keep them from being saved. */
export function invalidParts(
	status: Pick<ContentStatus, 'doc_errors'> | null | undefined,
	live: Partial<Record<LivePart, ContentError[]>> = {}
): LivePart[] {
	const errors = partErrors(status, live);
	return PARTS.filter((part) => errors[part].some(isBlocking));
}

/** The errors of what the draft is saved without: questions with no text. */
/** Per part, the errors of what its draft is saved without; only the parts
 * that have any. */
export type Skipped = Partial<Record<LivePart, ContentError[]>>;

export function skippedErrors(
	status: Pick<ContentStatus, 'doc_errors'> | null | undefined,
	live: Partial<Record<LivePart, ContentError[]>> = {}
): Skipped {
	const errors = partErrors(status, live);
	return Object.fromEntries(
		PARTS.map((part) => [part, errors[part].filter((error) => error.skipped)]).filter(
			([, skipped]) => skipped.length > 0
		)
	);
}

/** "Question 1.6 has no text." for each: the backend says it so. */
const messages = (skipped: ContentError[]) => skipped.map((error) => error.message).join(' ');

/**
 * Why publishing waits on what the draft is saved without, or undefined
 * when there is none. Worded as the backend refuses it.
 */
export function writeFirst(skipped: Skipped): string | undefined {
	const sentences = [];
	if (skipped.welcome?.length) {
		// "Enter a contact email address."
		const enter = skipped.welcome[0].message.replace(/\.$/, '');
		sentences.push(
			`${enter} on the welcome page, or stop showing the contact box, before publishing.`
		);
	}
	if (skipped.guide?.length) {
		const them =
			skipped.guide.length === 1 ? 'the question, or delete it,' : 'the questions, or delete them,';
		sentences.push(`${messages(skipped.guide)} Write ${them} before publishing.`);
	}
	return sentences.join(' ') || undefined;
}

/** What a test leaves out, or undefined when it leaves nothing out. */
export function testSkips(skipped: Skipped): string | undefined {
	const sentences = [];
	if (skipped.welcome?.length) {
		sentences.push(
			'The welcome page has no valid contact email, so the test shows it without the contact box.'
		);
	}
	if (skipped.guide?.length) {
		sentences.push(
			`${messages(skipped.guide)} The test skips ${skipped.guide.length === 1 ? 'it' : 'them'}.`
		);
	}
	return sentences.join(' ') || undefined;
}

/** What a part's draft is saved without, and what that holds back. */
export function skippedNote(part: LivePart): string {
	return part === 'welcome'
		? "The welcome page has no valid contact email. Tests show it without the contact box, and the interview can't be published until it is fixed."
		: `The ${pageName(part)} has questions with no text yet. Tests skip them, and the interview can't be published until they are written or deleted.`;
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
