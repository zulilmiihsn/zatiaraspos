const MARKER = 'ZATIARASPOS-MAINT-260720-BY1';
const HEADERS = {
	'Cache-Control': 'no-store, no-cache, must-revalidate',
	Pragma: 'no-cache',
	'Retry-After': '300',
	'X-Maintenance-Marker': MARKER
};

const HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pemeliharaan Zatiaras POS</title><style>:root{font-family:Geist,Outfit,system-ui,sans-serif}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f3f1ec;color:#20241f}main{width:min(42rem,calc(100% - 3rem));border-left:.35rem solid #b65f3c;padding:1.5rem 0 1.5rem 2rem}h1{margin:0 0 .75rem;font-size:clamp(2rem,7vw,4.5rem);letter-spacing:-.055em;line-height:.95}p{margin:0;max-width:34rem;line-height:1.65}code{display:block;margin-top:1.5rem;font-size:.72rem;color:#6b6f67}</style></head><body><main><h1>Sistem sedang dirawat.</h1><p>Akses sementara ditutup saat pembaruan basis data berlangsung. Coba lagi beberapa saat.</p><code>${MARKER}</code></main></body></html>`;

export default {
	async fetch(request) {
		const pathname = new URL(request.url).pathname;
		if (pathname.startsWith('/api/')) {
			return Response.json(
				{ ok: false, error: 'maintenance', marker: MARKER },
				{ status: 503, headers: HEADERS }
			);
		}
		return new Response(HTML, {
			status: 503,
			headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' }
		});
	}
};
