import type {
	AnalysisCategoryPublic,
	AuthorPublic,
	MessageAnnotationPublic,
	MessageCommentPublic
} from '$lib/api/types.gen';

/** Display name for the author of an annotation or a comment. */
export function authorName(author: AuthorPublic | null | undefined): string {
	if (!author) return 'Unknown user';
	const name = [author.first_name, author.last_name].filter(Boolean).join(' ').trim();
	return name || author.email;
}

/** Initials for an author avatar, e.g. "Ada Lovelace" -> "AL". */
export function authorInitials(author: AuthorPublic | null | undefined): string {
	if (!author) return '?';
	const initials = [author.first_name, author.last_name]
		.filter(Boolean)
		.map((part) => part!.trim().charAt(0))
		.join('');
	return (initials || author.email.charAt(0)).toUpperCase();
}

export interface AnnotationSummary {
	tags: { name: string; color: string }[];
	scores: { name: string; value: number; color: string }[];
}

/** The tags and scores of one annotation, resolved against the project's categories. */
export function summarizeAnnotation(
	annotation: MessageAnnotationPublic,
	categories: AnalysisCategoryPublic[]
): AnnotationSummary {
	const tags: AnnotationSummary['tags'] = [];
	const scores: AnnotationSummary['scores'] = [];

	for (const value of annotation.values) {
		const category = categories.find((c) => c.id === value.category_id);
		if (!category) continue;

		if (category.type === 'tag' && value.value_int === 1) {
			tags.push({ name: category.name, color: category.color });
		} else if (category.type === 'score') {
			scores.push({ name: category.name, value: value.value_int, color: category.color });
		}
	}

	return { tags, scores };
}

/** Roots plus replies: what the comment badge on a message counts. */
export function countComments(comments: MessageCommentPublic[] | undefined): number {
	if (!comments) return 0;
	return comments.reduce((total, comment) => total + 1 + (comment.replies?.length ?? 0), 0);
}

/** Absolute timestamp, and a relative one for anything written recently. */
export function formatCommentTime(timestamp: string): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '';

	const secondsAgo = (Date.now() - date.getTime()) / 1000;
	if (secondsAgo < 60) return 'just now';
	if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`;
	if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} h ago`;

	return date.toLocaleString('en-GB', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}
