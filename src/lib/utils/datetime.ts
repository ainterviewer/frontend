/**
 * Dates as the app shows them, in one place.
 *
 * The API sends timestamps with their offset (`2026-08-21T07:01:00+02:00`), so
 * `new Date` reads the right instant wherever the reader is, and these render
 * it in the reader's own zone. During SSR that is the server's zone, which the
 * image sets to the app's (`TZ` in the Dockerfile); a reader elsewhere sees the
 * hydrated value replace it.
 *
 * One locale for every date, `en-GB` and 24-hour, so a table, a card and a
 * printed report spell the same day the same way.
 */

const LOCALE = 'en-GB';

type DateInput = string | Date | null | undefined;

function parse(value: DateInput): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Date and time, compact enough for a table column: `21/08/2026 · 07:01`. */
export function formatDate(value: DateInput): string {
	const date = parse(value);
	if (!date) return '';
	return date
		.toLocaleString(LOCALE, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		})
		.replace(', ', ' · ');
}

/** Down to the second, for a title on hover: `21/08/2026, 07:01:00`. */
export function formatDateFull(value: DateInput): string {
	return parse(value)?.toLocaleString(LOCALE, { hour12: false }) ?? '';
}

/** The time of day alone: `07:01`. */
export function formatTime(value: DateInput): string {
	return (
		parse(value)?.toLocaleTimeString(LOCALE, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}) ?? ''
	);
}

const DAY_STYLES = {
	/** `21/08/2026` */
	numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
	/** `21 Aug 2026` */
	medium: { day: 'numeric', month: 'short', year: 'numeric' },
	/** `21 August 2026` */
	long: { day: 'numeric', month: 'long', year: 'numeric' }
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/** The day alone, in one of three lengths. */
export function formatDay(value: DateInput, style: keyof typeof DAY_STYLES = 'numeric'): string {
	return parse(value)?.toLocaleDateString(LOCALE, DAY_STYLES[style]) ?? '';
}

/**
 * How long ago, for anything written in the last day (`just now`, `5 min ago`,
 * `3 h ago`), and the day and time after that: `21 Aug, 07:01`.
 */
export function formatRelative(value: DateInput, now: number = Date.now()): string {
	const date = parse(value);
	if (!date) return '';

	const secondsAgo = (now - date.getTime()) / 1000;
	if (secondsAgo < 60) return 'just now';
	if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`;
	if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} h ago`;

	return date.toLocaleString(LOCALE, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}
