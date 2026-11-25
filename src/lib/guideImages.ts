import type { Image } from '$lib/api/types.gen';
import type { Message } from '$lib/components/interview/types';

// Guide images go to the browser by name and load from the backend: the
// guide and the messages name an image and never carry it.

/** A guide image of the respondent's own interview. The backend reads the
 *  interview from the `interview_token` cookie and serves only images its
 *  guide shows, so the URL needs nothing else. */
export function interviewImageUrl(name: string): string {
	return `/api/interview/images/${encodeURIComponent(name)}`;
}

/** One of a project's guide images, for viewers of the project: the
 *  editor's preview, transcripts and exports. */
export function projectImageUrl(projectId: string, name: string): string {
	return `/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(name)}`;
}

/** A stored message's image as a transcript bubble draws it, loaded from the
 *  project's images. The schema allows a list, but a message shows at most
 *  one. */
export function transcriptImage(
	projectId: string,
	image: Image | Image[] | null | undefined
): Message['image'] {
	const img = Array.isArray(image) ? image[0] : image;
	if (!img?.name) return undefined;
	return {
		src: projectImageUrl(projectId, img.name),
		alt: img.alt,
		primer: img.primer || undefined
	};
}
