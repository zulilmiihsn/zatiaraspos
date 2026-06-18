import type { Handle } from '@sveltejs/kit';
import { getAuthSession } from '$lib/server/sessionStore';
import {
	branchFromObservation,
	recordErrorEvent,
	recordRequestMetric
} from '$lib/server/observability';

export const handle: Handle = async ({ event, resolve }) => {
	const startedAt = Date.now();
	const sessionId = event.cookies.get('zatiaras_sid');
	event.locals.authSession = await getAuthSession(event.platform, sessionId);
	const observedBranch = branchFromObservation(
		event.platform,
		event.locals.authSession,
		event.url.searchParams.get('branch')
	);

	const csrfProtectedRoutes = ['/api/veriflogin', '/api/gantikeamanan', '/api/logout'];
	const isCsrfProtected =
		csrfProtectedRoutes.some((route) => event.url.pathname.startsWith(route)) &&
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method);

	if (isCsrfProtected) {
		const csrfCookie = event.cookies.get('zatiaras_csrf');
		const csrfHeader = event.request.headers.get('x-csrf-token');

		if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
			return new Response(
				JSON.stringify({ success: false, code: 'CSRF_INVALID', message: 'CSRF token invalid' }),
				{
					status: 403,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}
	}

	const protectedApiRoutes = ['/api/aichat', '/api/gantikeamanan'];
	const isProtectedApi = protectedApiRoutes.some((route) => event.url.pathname.startsWith(route));

	if (isProtectedApi && !event.locals.authSession) {
		return new Response(
			JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
			{
				status: 401,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}

	let response: Response;
	try {
		response = await resolve(event);
	} catch (error) {
		await recordErrorEvent(event.platform, observedBranch, {
			source: `${event.request.method} ${event.url.pathname}`,
			error,
			session: event.locals.authSession,
			context: { path: event.url.pathname }
		});
		throw error;
	}

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: wss: https://openrouter.ai https://unpkg.com https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; media-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
	);

	if (event.url.pathname.startsWith('/api/')) {
		await recordRequestMetric(event.platform, observedBranch, {
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Date.now() - startedAt,
			dbMeta: response.headers.get('x-d1-meta'),
			session: event.locals.authSession
		});
	}

	return response;
};
