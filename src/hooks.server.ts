import type { Handle } from '@sveltejs/kit';
import { getAuthSession } from '$lib/server/sessionStore';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('zatiaras_sid');
	event.locals.authSession = getAuthSession(sessionId);

	const csrfProtectedRoutes = ['/api/veriflogin', '/api/gantikeamanan', '/api/logout'];
	const isCsrfProtected =
		csrfProtectedRoutes.some((route) => event.url.pathname.startsWith(route)) &&
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method);

	if (isCsrfProtected) {
		const csrfCookie = event.cookies.get('zatiaras_csrf');
		const csrfHeader = event.request.headers.get('x-csrf-token');

		if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
			return new Response(JSON.stringify({ success: false, code: 'CSRF_INVALID', message: 'CSRF token invalid' }), {
				status: 403,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}
	}

	const protectedApiRoutes = ['/api/aichat', '/api/gantikeamanan'];
	const isProtectedApi = protectedApiRoutes.some((route) => event.url.pathname.startsWith(route));

	if (isProtectedApi && !event.locals.authSession) {
		return new Response(JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' }), {
			status: 401,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}

	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; media-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
	);

	return response;
};
