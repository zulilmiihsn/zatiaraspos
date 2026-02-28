import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.authSession) {
		return json(
			{ success: false, authenticated: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
			{ status: 401 }
		);
	}

	return json({
		success: true,
		authenticated: true,
		user: {
			id: locals.authSession.userId,
			username: locals.authSession.username,
			role: locals.authSession.role
		},
		expiresAt: locals.authSession.expiresAt
	});
};
