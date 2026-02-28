import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteAuthSession } from '$lib/server/sessionStore';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('zatiaras_sid');
	deleteAuthSession(sessionId);

	cookies.delete('zatiaras_sid', {
		path: '/'
	});

	return json({ success: true });
};
