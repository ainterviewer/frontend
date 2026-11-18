import { Versions } from '$lib/api';
import type { ContentStatus } from '$lib/api/types.gen';

/**
 * The content's version status, which the project's layout load hands to
 * every page in it: the sidebar marks the parts that are invalid by it, and
 * the action bar (`PublishControl`) draws it on the first paint rather than
 * once its own fetch returns. Null when it cannot be had, a request that
 * failed included, so a load may start it before anything that can throw:
 * the bar fetches it itself either way, for the revision publishing writes
 * against.
 */
export async function loadContentStatus(
	projectId: string,
	fetch?: typeof globalThis.fetch
): Promise<ContentStatus | null> {
	try {
		const { data } = await Versions.getContentStatus({ path: { project_id: projectId }, fetch });
		return data ?? null;
	} catch {
		return null;
	}
}
