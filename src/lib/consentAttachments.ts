import type { ConsentAttachmentPublic } from '$lib/api/types.gen';

/** A PDF shown with the consent: the link's text, its size and where it opens. */
export type ConsentAttachmentLink = { label: string; size: number; href: string };

/** A file size the way the consent screen shows it; units are the same in
 *  every language, so there is nothing to translate. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Links to the consent PDFs respondents in `language` are served, for the
 * listing `getRespondentConsentAttachments` returned. The backend resolves the
 * same fallback to the default language's set for the file as for the list,
 * so the link names the respondent's language, not the one it came from.
 */
export function respondentAttachmentLinks(
	projectId: string,
	language: string,
	attachments: ConsentAttachmentPublic[],
	query: { draft?: boolean; share?: string } = {}
): ConsentAttachmentLink[] {
	const params = new URLSearchParams();
	if (query.draft) params.set('draft', 'true');
	if (query.share) params.set('share', query.share);
	const search = params.size ? `?${params}` : '';
	return attachments.map((a) => ({
		label: a.label,
		size: a.size,
		href:
			`/api/projects/${encodeURIComponent(projectId)}/guide/consent/` +
			`${encodeURIComponent(language)}/attachments/${encodeURIComponent(a.filename)}${search}`
	}));
}

/** A link to one of a language's own consent PDFs, for the editor. */
export function editorAttachmentLink(
	projectId: string,
	language: string,
	attachment: ConsentAttachmentPublic
): ConsentAttachmentLink {
	return {
		label: attachment.label,
		size: attachment.size,
		href:
			`/api/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(language)}` +
			`/consent-attachments/${encodeURIComponent(attachment.filename)}`
	};
}

/** Links to one language's own consent PDFs, for the editor. */
export function editorAttachmentLinks(
	projectId: string,
	language: string,
	attachments: ConsentAttachmentPublic[]
): ConsentAttachmentLink[] {
	return attachments.map((a) => editorAttachmentLink(projectId, language, a));
}
