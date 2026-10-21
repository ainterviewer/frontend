import type { ProjectPublic } from '$lib/api';

/**
 * How the dashboard lists projects: the order within each folder, and whether
 * archived folders and projects are shown.
 *
 * Kept in a cookie rather than in local storage so the server renders the page
 * already in that order: a preference read only in the browser would paint the
 * default first and then reshuffle every folder under the reader's eye.
 */
export type SortKey = 'updated' | 'created' | 'name';
export type SortDirection = 'asc' | 'desc';
export type DashboardView = {
	sort: SortKey;
	direction: SortDirection;
	showArchived: boolean;
};

export const VIEW_COOKIE = 'dashboard_view';

export const SORT_LABELS: Record<SortKey, string> = {
	updated: 'Last updated',
	created: 'Created',
	name: 'Name'
};

/** Which way each key reads naturally, and so the way it starts out: the
 * newest first for dates, A to Z for names. */
export const NATURAL_DIRECTION: Record<SortKey, SortDirection> = {
	updated: 'desc',
	created: 'desc',
	name: 'asc'
};

export const DEFAULT_VIEW: DashboardView = {
	sort: 'updated',
	direction: 'desc',
	showArchived: false
};

/** The view a cookie holds, falling back field by field on anything unknown,
 * so a stale or hand-edited cookie never breaks the page. */
export function parseView(raw: string | undefined): DashboardView {
	if (!raw) return DEFAULT_VIEW;
	let value: Partial<Record<keyof DashboardView, unknown>>;
	try {
		value = JSON.parse(raw);
	} catch {
		return DEFAULT_VIEW;
	}
	if (typeof value !== 'object' || value === null) return DEFAULT_VIEW;
	const sort = value.sort as SortKey;
	const direction = value.direction as SortDirection;
	return {
		sort: Object.hasOwn(SORT_LABELS, sort) ? sort : DEFAULT_VIEW.sort,
		direction: direction === 'asc' || direction === 'desc' ? direction : DEFAULT_VIEW.direction,
		showArchived: value.showArchived === true
	};
}

/** Written from the browser; a year, so it outlasts the session. */
export function saveView(view: DashboardView) {
	const value = encodeURIComponent(JSON.stringify(view));
	document.cookie = `${VIEW_COOKIE}=${value}; path=/dashboard; max-age=31536000; samesite=lax`;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Parsed rather than compared as strings: the stamps carry their UTC offset,
// which changes with daylight saving, and text order is not time order across it.
const time = (stamp: string) => Date.parse(stamp);

function compare(a: ProjectPublic, b: ProjectPublic, sort: SortKey): number {
	switch (sort) {
		case 'name':
			return collator.compare(a.title, b.title);
		case 'created':
			return time(a.created_at) - time(b.created_at);
		case 'updated':
			// A project never updated sorts as updated when it was made.
			return time(a.last_updated ?? a.created_at) - time(b.last_updated ?? b.created_at);
	}
}

/** A sorted copy. Ties fall back to the name, so the order is stable whatever
 * order the server sent them in. */
export function sortProjects(projects: ProjectPublic[], view: DashboardView): ProjectPublic[] {
	const sign = view.direction === 'asc' ? 1 : -1;
	return [...projects].sort(
		(a, b) => sign * compare(a, b, view.sort) || collator.compare(a.title, b.title)
	);
}
