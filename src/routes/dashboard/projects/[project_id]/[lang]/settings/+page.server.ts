import { error } from '@sveltejs/kit';

import { Projects, Versions } from '$lib/api';
import type { ProjectPublic } from '$lib/api/types.gen';

import type { PageServerLoad } from './$types';

/** Where the project was copied from, as far as this user may see it: the
 * source may be gone, or in a folder they are not in. */
async function copiedFrom(project: ProjectPublic) {
	const sourceId = project.cloned_from_project_id;
	if (!sourceId) return null;
	const versionId = project.cloned_from_version_id;
	const [source, version] = await Promise.all([
		Projects.getProject({ path: { project_id: sourceId } }),
		versionId
			? Versions.getContentVersion({ path: { project_id: sourceId, version_id: versionId } })
			: null
	]);
	if (!source.data) return null;
	const v = version?.data;
	return {
		id: sourceId,
		title: source.data.title,
		version: v ? (v.semver ? `v${v.semver}` : `version ${v.version_no}`) : null
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const { project_id } = params;

	const projectRes = await Projects.getProject({
		path: { project_id: project_id }
	});

	if (projectRes.error || !projectRes.data) {
		error(404, 'Project not found');
	}

	return {
		project: projectRes.data,
		copiedFrom: await copiedFrom(projectRes.data)
	};
};
