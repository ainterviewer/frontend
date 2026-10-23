import { error } from '@sveltejs/kit';

import { Default, Folders } from '$lib/api';

import type { PageServerLoad } from './$types';
import { parseView, VIEW_COOKIE } from './dashboardView';

export const load: PageServerLoad = async ({ cookies }) => {
	const [foldersRes, langRes] = await Promise.all([Folders.getFolders(), Default.getLanguages()]);

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
		languages: langRes.data,
		view: parseView(cookies.get(VIEW_COOKIE))
	};
};
