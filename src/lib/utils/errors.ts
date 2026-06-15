/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	return String(e);
}
