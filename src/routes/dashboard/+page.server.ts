import { Default, Folders } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookieHeader = request.headers.get('cookie');

	const [foldersRes, langRes] = await Promise.all([
		Folders.getFolders({ headers: { cookie: cookieHeader || '' } }),
		Default.getLanguages({ headers: { cookie: cookieHeader || '' } })
	]);

	return {
		folders: (foldersRes as any).data || foldersRes,
		languages: (langRes as any).data || langRes
	};
};
