import { describe, expect, it } from 'vitest';

import type { ProjectPublic } from '$lib/api';

import { DEFAULT_VIEW, parseView, sortProjects } from './dashboardView';

function project(title: string, created_at: string, last_updated: string | null = null) {
	return { id: title, title, created_at, last_updated } as ProjectPublic;
}

const titles = (projects: ProjectPublic[]) => projects.map((p) => p.title);

describe('parseView', () => {
	it('falls back to the default without a cookie, or with a broken one', () => {
		expect(parseView(undefined)).toEqual(DEFAULT_VIEW);
		expect(parseView('not json')).toEqual(DEFAULT_VIEW);
		expect(parseView('null')).toEqual(DEFAULT_VIEW);
	});

	it('keeps the known fields and replaces the unknown ones', () => {
		expect(parseView('{"sort":"name","direction":"sideways","showArchived":true}')).toEqual({
			sort: 'name',
			direction: 'desc',
			showArchived: true
		});
		expect(parseView('{"sort":"toString"}').sort).toBe('updated');
	});
});

describe('sortProjects', () => {
	const projects = [
		project('Week 10', '2026-03-01T10:00:00+01:00', '2026-10-01T10:00:00+02:00'),
		project('week 2', '2026-01-01T10:00:00+01:00'),
		project('Week 1', '2026-02-01T10:00:00+01:00', '2026-09-01T10:00:00+02:00')
	];

	it('sorts names naturally and without regard to case', () => {
		expect(
			titles(sortProjects(projects, { ...DEFAULT_VIEW, sort: 'name', direction: 'asc' }))
		).toEqual(['Week 1', 'week 2', 'Week 10']);
	});

	it('takes a project never updated as updated when it was made', () => {
		expect(titles(sortProjects(projects, DEFAULT_VIEW))).toEqual(['Week 10', 'Week 1', 'week 2']);
	});

	it('orders by time, not by the text of the stamp', () => {
		// 07:30 and 07:00 UTC: as text, the later winter stamp sorts first.
		const across = [
			project('winter', '2026-11-01T08:30:00+01:00'),
			project('summer', '2026-11-01T09:00:00+02:00')
		];
		expect(
			titles(sortProjects(across, { ...DEFAULT_VIEW, sort: 'created', direction: 'asc' }))
		).toEqual(['summer', 'winter']);
	});

	it('breaks ties by name', () => {
		const tied = [project('b', '2026-01-01T10:00:00Z'), project('a', '2026-01-01T10:00:00Z')];
		expect(titles(sortProjects(tied, { ...DEFAULT_VIEW, sort: 'created' }))).toEqual(['a', 'b']);
	});
});
