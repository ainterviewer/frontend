import type { InterviewType } from '$lib/api/types.gen';

/** Real respondents only, which is the cohort the page opens on. */
export const DISTRIBUTED_ONLY: readonly InterviewType[] = ['distributed'];

/** ...and the same plus the project's own test runs. */
export const WITH_TESTS: readonly InterviewType[] = [
	'distributed',
	'manual_test',
	'synthetic_test'
];

/** The shape the generated client wants, which is mutable arrays. */
export type ReportQuery = {
	interview_types: InterviewType[];
	completed_only: boolean;
	languages: string[];
};

/**
 * The filters the page starts on. Kept here rather than in the component so
 * `load` can start the matching request before the component exists.
 *
 * A function rather than a shared constant: the result is handed straight to
 * the generated client, and a value that both escapes into a library and is
 * read back by `isDefaultQuery` is one careless `sort()` away from being a bug
 * nobody can see. The constants above stay `readonly` and are copied out here,
 * so nothing downstream ever holds the original.
 */
export function defaultQuery(): ReportQuery {
	return {
		interview_types: [...DISTRIBUTED_ONLY],
		completed_only: false,
		// The generated client omits an empty array, which is exactly the "no
		// language filter" the backend expects.
		languages: []
	};
}

function sameList<T>(a: readonly T[], b: readonly T[]) {
	return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Whether the response `load` preloaded answers this query. */
export function isDefaultQuery(query: ReportQuery) {
	const fallback = defaultQuery();
	return (
		query.completed_only === fallback.completed_only &&
		sameList(query.languages, fallback.languages) &&
		sameList(query.interview_types, fallback.interview_types)
	);
}
