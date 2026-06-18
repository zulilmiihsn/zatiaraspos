import { error as kitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.authSession) {
		throw redirect(302, '/login');
	}

	if (locals.authSession.role !== 'admin') {
		throw kitError(403, 'Monitoring hanya untuk admin');
	}

	return {
		user: {
			username: locals.authSession.username,
			role: locals.authSession.role,
			branch: locals.authSession.branch
		}
	};
};
