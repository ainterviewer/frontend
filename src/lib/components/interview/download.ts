import { Projects as Api } from '$lib/api';
import type { ExportMessagesRequest } from '$lib/api/types.gen';
import { toastApiError } from '$lib/utils/toast';

export type ExportFormat = NonNullable<ExportMessagesRequest['format']>;

/** Which interviews to export: ticked ids, or everything matching the filters. */
export type InterviewSelection = Pick<ExportMessagesRequest, 'interview_ids' | 'filters'>;

/**
 * Export interviews and hand the file to the browser.
 *
 * The server names the file (after the participant for a single interview),
 * so it is read off Content-Disposition rather than made up here. Times in a
 * transcript are shown in the browser's own time zone.
 */
export async function downloadInterviews(
	projectId: string,
	selection: InterviewSelection,
	format: ExportFormat,
	archive = false
): Promise<boolean> {
	const { data, error, response } = await Api.exportMessages({
		path: { project_id: projectId },
		body: {
			...selection,
			format,
			archive,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
		},
		parseAs: 'blob'
	});

	if (error || !data) {
		toastApiError(error, 'Failed to download');
		return false;
	}

	const disposition = response?.headers.get('content-disposition') ?? '';
	const filename =
		/filename="([^"]+)"/.exec(disposition)?.[1] ?? `interviews.${archive ? 'zip' : format}`;

	const url = URL.createObjectURL(data);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return true;
}
