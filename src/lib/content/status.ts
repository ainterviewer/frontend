import { Versions } from '$lib/api';
import type { ContentStatus } from '$lib/api/types.gen';

/**
 * The content's version status, for a page load to hand its action bar
 * (`PublishControl`), which then draws it on the first paint rather than once
 * its own fetch returns. Null when it cannot be had: the bar fetches it
 * itself either way, for the revision publishing writes against.
 */
export async function loadContentStatus(
	projectId: string,
	fetch?: typeof globalThis.fetch
): Promise<ContentStatus | null> {
	const { data } = await Versions.getContentStatus({ path: { project_id: projectId }, fetch });
	return data ?? null;
}
