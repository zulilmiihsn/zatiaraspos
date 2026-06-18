export { RealtimeDurableObject } from './realtimeDurableObject.js';

export default {
	/**
	 * @param {Request} request
	 */
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/health') {
			return new Response(JSON.stringify({ ok: true, service: 'zatiaraspos-realtime' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Not found', { status: 404 });
	}
};
