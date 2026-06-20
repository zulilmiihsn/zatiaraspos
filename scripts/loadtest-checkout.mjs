/**
 * Load test checkout konkuren untuk /api/pos/transaction.
 *
 * Tujuan: bukti performa di bawah beban (P50/P95/P99, throughput, distribusi
 * status) ketika banyak kasir checkout barengan — bukan sekadar telemetry.
 *
 * Pakai:
 *   UAT_PASSWORD=xxx node scripts/loadtest-checkout.mjs [baseUrl] [branch]
 *
 * Env opsional:
 *   LOAD_CONCURRENCY  jumlah worker paralel (default 10)
 *   LOAD_TOTAL        total request checkout (default 30 = 1 rate window)
 *   LOAD_KASIR_USER   username kasir (default 'kasir')
 *   LOAD_OWNER_USER   username pemilik untuk cleanup (default 'pemilik')
 *   LOAD_PRODUCT_ID   id produk yang dibeli (default 'uat-produk-es-teh')
 *   LOAD_NO_CLEANUP   '1' untuk skip hapus transaksi setelah selesai
 *
 * Catatan: script ini MEMBUAT transaksi nyata. Default aman (30 req, 1 window).
 * Rate limit checkout = 30/60s per identitas, jadi 429 di atas itu WAJAR dan
 * dihitung terpisah, bukan sebagai error.
 */
import { randomUUID } from 'node:crypto';

const baseUrl = (process.argv[2] || 'https://zatiaraspos.pages.dev').replace(/\/$/, '');
const branch = process.argv[3] || 'samarinda';
const password = process.env.UAT_PASSWORD;
const concurrency = Math.max(1, Number(process.env.LOAD_CONCURRENCY || 10));
const total = Math.max(1, Number(process.env.LOAD_TOTAL || 30));
const kasirUser = process.env.LOAD_KASIR_USER || 'kasir';
const ownerUser = process.env.LOAD_OWNER_USER || 'pemilik';
const productId = process.env.LOAD_PRODUCT_ID || 'uat-produk-es-teh';
const skipCleanup = process.env.LOAD_NO_CLEANUP === '1';

if (!password) {
	throw new Error('UAT_PASSWORD wajib diisi melalui environment');
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function getSetCookies(headers) {
	if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
	const cookie = headers.get('set-cookie');
	return cookie ? [cookie] : [];
}

function cookiePair(cookies, name) {
	const cookie = cookies.find((item) => item.startsWith(`${name}=`));
	return cookie ? cookie.split(';')[0] : '';
}

async function login(username) {
	const csrfResponse = await fetch(`${baseUrl}/api/csrf`);
	assert(csrfResponse.ok, `CSRF failed: ${csrfResponse.status}`);
	const csrfJson = await csrfResponse.json();
	const csrfCookie = cookiePair(getSetCookies(csrfResponse.headers), 'zatiaras_csrf');
	assert(csrfJson.token && csrfCookie, 'CSRF token/cookie missing');

	const loginResponse = await fetch(`${baseUrl}/api/veriflogin`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-csrf-token': csrfJson.token,
			Cookie: csrfCookie
		},
		body: JSON.stringify({ username, password, branch })
	});
	const loginJson = await loginResponse.json().catch(() => null);
	assert(loginResponse.ok && loginJson?.success, `${username} login failed: ${loginResponse.status}`);
	const sidCookie = cookiePair(getSetCookies(loginResponse.headers), 'zatiaras_sid');
	return [csrfCookie, sidCookie].filter(Boolean).join('; ');
}

function percentile(sortedAsc, p) {
	if (sortedAsc.length === 0) return 0;
	const rank = (p / 100) * (sortedAsc.length - 1);
	const low = Math.floor(rank);
	const high = Math.ceil(rank);
	if (low === high) return sortedAsc[low];
	return sortedAsc[low] + (sortedAsc[high] - sortedAsc[low]) * (rank - low);
}

async function checkoutOnce(cookie) {
	const idempotencyKey = `loadtest-${randomUUID()}`;
	const start = performance.now();
	let status = 0;
	let transactionId = null;
	let errorBody = null;
	try {
		const response = await fetch(`${baseUrl}/api/pos/transaction`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				idempotency_key: idempotencyKey,
				customer_name: 'LOADTEST',
				payment_method: 'tunai',
				cash_received: 10000,
				items: [{ product_id: productId, qty: 1, add_on_ids: [] }]
			})
		});
		status = response.status;
		const payload = await response.json().catch(() => null);
		if (response.ok) transactionId = payload?.data?.transaction_id || idempotencyKey;
		else errorBody = payload;
	} catch (err) {
		status = -1;
		errorBody = String(err);
	}
	const durationMs = performance.now() - start;
	return { status, durationMs, transactionId, errorBody };
}

async function runPool(cookie) {
	const results = [];
	let dispatched = 0;
	async function worker() {
		while (dispatched < total) {
			dispatched += 1;
			results.push(await checkoutOnce(cookie));
		}
	}
	const startedAt = performance.now();
	await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
	const wallMs = performance.now() - startedAt;
	return { results, wallMs };
}

async function cleanup(ownerCookie, transactionIds) {
	let deleted = 0;
	for (const transactionId of transactionIds) {
		for (const table of ['transaksi_kasir', 'buku_kas']) {
			const ok = await fetch(`${baseUrl}/api/data`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
				body: JSON.stringify({
					table,
					action: 'delete',
					branch,
					payload: {},
					where: { transaction_id: transactionId }
				})
			})
				.then((r) => r.ok)
				.catch(() => false);
			if (ok && table === 'transaksi_kasir') deleted += 1;
		}
	}
	return deleted;
}

function report({ results, wallMs }) {
	const byStatus = new Map();
	for (const r of results) byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);

	const ok = results.filter((r) => r.status >= 200 && r.status < 300);
	const rateLimited = results.filter((r) => r.status === 429);
	const errors = results.filter((r) => r.status !== 429 && (r.status < 200 || r.status >= 300));

	// Latency hanya dari respons yang benar-benar diproses server (2xx + 429),
	// network error (-1) dikecualikan dari percentile.
	const latencies = results
		.filter((r) => r.status > 0)
		.map((r) => r.durationMs)
		.sort((a, b) => a - b);
	const sum = latencies.reduce((a, b) => a + b, 0);
	const fmt = (n) => `${n.toFixed(1)}ms`;

	console.log('\n=== LOAD TEST CHECKOUT — HASIL ===');
	console.log(`target      : ${baseUrl}  (branch=${branch})`);
	console.log(`konfigurasi : total=${total}  concurrency=${concurrency}  produk=${productId}`);
	console.log(`durasi total: ${(wallMs / 1000).toFixed(2)}s`);
	console.log(`throughput  : ${(results.length / (wallMs / 1000)).toFixed(1)} req/s`);
	console.log('');
	console.log(`sukses (2xx): ${ok.length}`);
	console.log(`rate-limit  : ${rateLimited.length}  (429 — wajar bila > 30/60s, fail-closed)`);
	console.log(`error lain  : ${errors.length}`);
	console.log('');
	console.log('distribusi status:');
	for (const [status, count] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
		const label = status === -1 ? 'network-error' : status;
		console.log(`  ${label}: ${count}`);
	}
	console.log('');
	if (latencies.length) {
		console.log('latency (server-processed):');
		console.log(`  min : ${fmt(latencies[0])}`);
		console.log(`  avg : ${fmt(sum / latencies.length)}`);
		console.log(`  p50 : ${fmt(percentile(latencies, 50))}`);
		console.log(`  p95 : ${fmt(percentile(latencies, 95))}`);
		console.log(`  p99 : ${fmt(percentile(latencies, 99))}`);
		console.log(`  max : ${fmt(latencies[latencies.length - 1])}`);
	}
	if (errors.length) {
		console.log('\ncontoh error (maks 3):');
		for (const e of errors.slice(0, 3)) {
			console.log(`  [${e.status}] ${JSON.stringify(e.errorBody)?.slice(0, 200)}`);
		}
	}
	return { ok, errors };
}

async function main() {
	console.log(`Login kasir='${kasirUser}' & pemilik='${ownerUser}' @ ${baseUrl} ...`);
	const cookie = await login(kasirUser);
	const ownerCookie = skipCleanup ? null : await login(ownerUser);

	// Validasi produk ada sebelum membanjiri server.
	const probe = await fetch(
		`${baseUrl}/api/data?table=produk&branch=${encodeURIComponent(branch)}&limit=50`,
		{ headers: { Cookie: cookie } }
	);
	const products = await probe.json().catch(() => null);
	assert(
		Array.isArray(products) && products.some((p) => p.id === productId),
		`Produk '${productId}' tidak ditemukan di branch '${branch}'`
	);

	console.log(`Mulai banjir checkout: ${total} request, ${concurrency} paralel ...`);
	const run = await runPool(cookie);
	const { ok, errors } = report(run);

	if (!skipCleanup && ownerCookie) {
		const ids = [...new Set(ok.map((r) => r.transactionId).filter(Boolean))];
		console.log(`\nCleanup ${ids.length} transaksi ...`);
		const deleted = await cleanup(ownerCookie, ids);
		console.log(`Terhapus: ${deleted}/${ids.length} transaksi_kasir (+ buku_kas terkait).`);
	} else {
		console.log('\nCleanup dilewati (LOAD_NO_CLEANUP=1). Transaksi LOADTEST tetap ada.');
	}

	// Exit non-zero hanya bila ada error non-429 (kegagalan nyata).
	if (errors.length > 0) {
		console.error(`\nGAGAL: ${errors.length} request error non-429.`);
		process.exit(1);
	}
	console.log('\nSelesai. Tidak ada error non-429.');
}

main().catch((err) => {
	console.error('Load test gagal:', err);
	process.exit(1);
});
