import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

export const GET = async () => {
	if (!env.API_URL) {
		return json({ status: 'fail', reason: 'API_URL not configured' }, { status: 503 });
	}

	try {
		const res = await fetch(`${env.API_URL}/api/health`, {
			signal: AbortSignal.timeout(2000)
		});
		if (!res.ok) {
			return json({ status: 'fail', reason: `backend responded ${res.status}` }, { status: 503 });
		}
		return json({ status: 'ok' });
	} catch (err) {
		return json(
			{ status: 'fail', reason: err instanceof Error ? err.message : 'backend unreachable' },
			{ status: 503 }
		);
	}
};
