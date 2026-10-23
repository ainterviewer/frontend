import type { ApiError, ErrorCode, StaleRevisionError } from '$lib/api';

/**
 * A request that got no response, as the toast interceptor hands it on once
 * it has told the user; the fetch's own error is its `cause`. In the browser
 * only -- on the server a failed fetch stays the `TypeError` it was.
 */
export class NetworkError extends Error {
	constructor(cause: unknown) {
		super('No response from the server', { cause });
		this.name = 'NetworkError';
	}
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

/**
 * Why a failed SDK call failed, in the backend's words: an `ApiError`'s
 * `detail`, or else the first message of FastAPI's 422, whose `detail` is a
 * list of validation errors -- an alias in the wrong shape, say. Undefined
 * when there is neither: a network failure, a plain-text body.
 */
export function errorReason(error: unknown): string | undefined {
	const body = apiError(error);
	if (body) return body.detail;
	const detail = (error as { detail?: unknown } | null)?.detail;
	if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
	return undefined;
}

/** The sentence to show for a failed SDK call, or `fallback` when it has none. */
export function errorDetail(error: unknown, fallback: string): string {
	return errorReason(error) ?? fallback;
}
