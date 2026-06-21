export { RealtimeDurableObject } from './realtimeDurableObject.js';

// Retensi log sistem (bukan data jualan). Dibersihkan otomatis via cron.
const LOG_RETENTION_DAYS = 90;
const CLEANUP_TABLES = ['audit_logs', 'request_metrics'];
const DB_BINDINGS = ['DB_SAMARINDA_GROUP', 'DB_BALIKPAPAN_GROUP', 'DB_BERAU_GROUP'];

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
	},

	/**
	 * Cron terjadwal: hapus log sistem lama (audit_logs, request_metrics) dari
	 * SEMUA database cabang. Hanya log/metrik — TIDAK menyentuh transaksi/menu.
	 * @param {ScheduledController} _event
	 * @param {Record<string, any>} env
	 */
	async scheduled(_event, env) {
		const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
		for (const binding of DB_BINDINGS) {
			const db = env[binding];
			if (!db) continue;
			for (const table of CLEANUP_TABLES) {
				try {
					await db.prepare(`DELETE FROM ${table} WHERE created_at < ?`).bind(cutoff).run();
				} catch {
					// Tabel mungkin belum ada / error sebagian — jangan gagalkan cron seluruhnya.
				}
			}
		}
	}
};
