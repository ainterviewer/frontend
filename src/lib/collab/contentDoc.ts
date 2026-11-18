import { Projects } from '$lib/api';
import type {
	ContentError,
	LocalizedConsent,
	LocalizedInterviewGuide,
	LocalizedWelcome
} from '$lib/api/types.gen';

/** The co-edited parts, as their docs' data. */
interface LiveParts {
	guide: LocalizedInterviewGuide;
	consent: LocalizedConsent;
	welcome: LocalizedWelcome;
}

/**
 * What editors see of a co-edited part, valid or not: the shared doc, which is
 * what an editor syncs to and what an export of the part should hold. The
 * saved part (`getLocalizedGuide` and the like) is the last *valid* doc, so
 * it lags behind while the doc is invalid -- a question with no text, an
 * email address half typed.
 *
 * The data is the part's JSON as the doc holds it. It is typed as the part,
 * which it is unless the doc is invalid; what reads it maps it leniently
 * (`mapToLocal`, the pages' defaults).
 */
export async function getContentDoc<P extends keyof LiveParts>(
	projectId: string,
	part: P,
	fetch?: typeof globalThis.fetch
): Promise<
	{ data: LiveParts[P]; errors: ContentError[]; error?: never } | { data?: never; error: unknown }
> {
	const { data, error } = await Projects.getContentDoc({
		path: { project_id: projectId, part },
		fetch
	});
	if (error || !data) return { error: error ?? new Error(`No ${part} returned`) };
	return { data: data.data as unknown as LiveParts[P], errors: data.errors ?? [] };
}
