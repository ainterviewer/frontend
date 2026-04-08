import { Default, Folders } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { cookieHeader } = locals;

	const [foldersRes, langRes] = await Promise.all([
		Folders.getFolders({ headers: { cookie: cookieHeader || '' } }),
		Default.getLanguages({ headers: { cookie: cookieHeader || '' } })
	]);

	if (foldersRes.error) {
		console.error('Failed to load folders', foldersRes.error);
		throw error(500, 'Failed to load folders');
	}

	if (langRes.error) {
		console.error('Failed to load languages', langRes.error);
		throw error(500, 'Failed to load languages');
	}

	return {
		folders: foldersRes.data,
		languages: langRes.data
	};
};
