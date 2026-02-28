import { randomBytes } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = randomBytes(32).toString('hex');

	cookies.set('zatiaras_csrf', token, {
		httpOnly: false,
		path: '/',
		sameSite: 'strict',
		secure: !dev,
		maxAge: 60 * 60 * 2
	});

	return json({ success: true, token });
};
