import type { AuthorPublic, CodingPublic, MessageCommentPublic } from '$lib/api/types.gen';
import type { Code } from '$lib/coding/codingTree';

/**
 * Small helpers shared by everything that shows a coding or a comment.
 *
 * Kept out of `$lib/coding`, which is the codebook's own domain and knows
 * nothing about who applied a code to what.
 */

/** Display name for the author of a coding or a comment. */
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

/** A coding with the code it names, for the views that draw both. */
export type ResolvedCoding = { coding: CodingPublic; code: Code };

/**
 * The codings of a message, each paired with its code, in codebook order.
 *
 * Codebook order rather than the order they were made in: the chips under a
 * message read as a reading of it, and a reading is easier to compare between
 * coders when the codes always come in the same sequence. A coding whose code
 * is not in the codebook is dropped -- the code was deleted, and the server
 * has deleted the coding too; this is only the screen catching up.
 */
export function resolveCodings(codings: CodingPublic[], codes: readonly Code[]): ResolvedCoding[] {
	const rank = new Map(codes.map((code, index) => [code.id, index]));
	return codings
		.flatMap((coding) => {
			const code = codes.find((candidate) => candidate.id === coding.code_id);
			return code ? [{ coding, code }] : [];
		})
		.sort((a, b) => (rank.get(a.code.id) ?? 0) - (rank.get(b.code.id) ?? 0));
}

/** What a chip says: the code, and a score's value. */
export function codingLabel({ coding, code }: ResolvedCoding): string {
	return coding.value_int === null || coding.value_int === undefined
		? code.name
		: `${code.name}: ${coding.value_int}`;
}

/** Whether a coding names part of the message rather than all of it. */
export function isSpan(coding: CodingPublic): boolean {
	return (
		coding.start_offset !== null &&
		coding.start_offset !== undefined &&
		coding.end_offset !== null &&
		coding.end_offset !== undefined
	);
}

/** The words a span coding points at, as they appear in the message. */
export function spanText(coding: CodingPublic, content: string): string {
	if (!isSpan(coding)) return '';
	return content.slice(coding.start_offset!, coding.end_offset!);
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

/** A stretch of a message, and every span coding that covers it. */
export type CodedSegment = { text: string; start: number; codings: ResolvedCoding[] };

/**
 * Splits a message into stretches that are coded the same way.
 *
 * Coders overlap: two codes can cover the same words, and one can sit inside
 * another. Rather than nesting the highlights -- which needs a tree and still
 * cannot draw two codes on one word -- the text is cut at every boundary any
 * coding names, so each piece has a single, complete answer to "what codes
 * cover this?". A piece with none is ordinary text.
 *
 * Whole-message codings are not boundaries: they say something about the turn
 * rather than about any stretch of it, and letting them highlight everything
 * would leave nothing for the spans to stand out against.
 */
export function segmentByCodings(
	content: string,
	codings: CodingPublic[],
	codes: readonly Code[]
): CodedSegment[] {
	const spans = resolveCodings(codings.filter(isSpan), codes);
	if (spans.length === 0) return [{ text: content, start: 0, codings: [] }];

	const cuts = new Set<number>([0, content.length]);
	for (const { coding } of spans) {
		// Clamped: the message is what it is, and a span reaching past it would
		// otherwise produce a segment of empty string at the end.
		cuts.add(Math.max(0, Math.min(coding.start_offset!, content.length)));
		cuts.add(Math.max(0, Math.min(coding.end_offset!, content.length)));
	}
	const bounds = [...cuts].sort((a, b) => a - b);

	const segments: CodedSegment[] = [];
	for (let i = 0; i < bounds.length - 1; i += 1) {
		const [start, end] = [bounds[i], bounds[i + 1]];
		if (start === end) continue;
		segments.push({
			text: content.slice(start, end),
			start,
			codings: spans.filter(
				({ coding }) => coding.start_offset! <= start && coding.end_offset! >= end
			)
		});
	}
	return segments;
}
