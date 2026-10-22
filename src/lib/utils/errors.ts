import type { ApiError, ErrorCode, StaleRevisionError } from '$lib/api';

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	return String(e);
}

/**
 * The `ApiError` body of a failed SDK call, or null when there is none: a
 * network failure, or FastAPI's 422, whose `detail` is a list of validation
 * errors rather than a sentence.
 *
 * Every other error the backend answers has this shape, so branch on `code`
 * and show `detail`; never match on the wording or on the status alone.
 */
export function apiError(error: unknown): ApiError | null {
	if (
		typeof error === 'object' &&
		error !== null &&
		'detail' in error &&
		typeof error.detail === 'string'
	) {
		return error as ApiError;
	}
	return null;
}

/** Whether `error` is an `ApiError` carrying `code`. */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
	return apiError(error)?.code === code;
}

/**
 * The revision to overwrite with, when a content write was refused because
 * someone saved in between (412 `stale_revision`); null for any other error.
 */
export function staleRevision(error: unknown): number | null {
	const body = apiError(error);
	return body?.code === 'stale_revision' ? (body as StaleRevisionError).current_revision : null;
}

/** The sentence to show for a failed SDK call, or `fallback` when it has none. */
export function errorDetail(error: unknown, fallback: string): string {
	return apiError(error)?.detail ?? fallback;
}
