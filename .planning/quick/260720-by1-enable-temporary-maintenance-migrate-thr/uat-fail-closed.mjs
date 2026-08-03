import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { open, readFile, rename, writeFile } from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const TASK = dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));
const ROOT = resolve(TASK, '../../..');
const WRAPPER = resolve(TASK, 'wrangler-safe-wrapper.mjs');
const JOURNAL = resolve(TASK, 'uat-transaction-journal.json');
const BASE = (process.argv[2] || 'https://zatiaraspos.pages.dev').replace(/\/$/, '');
const BRANCH = process.argv[3] || 'samarinda';
const MODE = process.argv[4] || 'api';

function assert(value, message) {
	if (!value) throw new Error(message);
}
async function loadPassword() {
	if (process.env.UAT_PASSWORD) return process.env.UAT_PASSWORD;
	const text = await readFile(resolve(ROOT, '.env'), 'utf8').catch(() => '');
	for (const raw of text.split(/\r?\n/)) {
		const match = raw.trim().match(/^UAT_PASSWORD\s*=\s*(.*)$/);
		if (!match) continue;
		let value = match[1].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		)
			value = value.slice(1, -1);
		if (value) return value;
	}
	throw new Error('UAT_PASSWORD unavailable');
}
const PASSWORD = await loadPassword();

async function fsyncPath(path, writable = false) {
	const handle = await open(path, writable ? 'r+' : 'r');
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
async function atomicJournal(value) {
	const temp = `${JOURNAL}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
	await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
	await fsyncPath(temp, true);
	await rename(temp, JOURNAL);
	await fsyncPath(JOURNAL, true);
	try {
		await fsyncPath(TASK);
	} catch (error) {
		if (!['EPERM', 'EISDIR', 'EINVAL', 'ENOTSUP'].includes(error.code)) throw error;
	}
	const readback = JSON.parse(await readFile(JOURNAL, 'utf8'));
	assert(JSON.stringify(readback) === JSON.stringify(value), 'journal readback mismatch');
}
async function readJournal() {
	try {
		return JSON.parse(await readFile(JOURNAL, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
}

function setCookies(headers) {
	return typeof headers.getSetCookie === 'function'
		? headers.getSetCookie()
		: [headers.get('set-cookie')].filter(Boolean);
}
function cookiePair(cookies, name) {
	const value = cookies.find((item) => item.startsWith(`${name}=`));
	return value ? value.split(';')[0] : '';
}
async function login(username) {
	const csrfResponse = await fetch(`${BASE}/api/csrf`, {
		headers: { 'Cache-Control': 'no-cache' }
	});
	assert(csrfResponse.ok, `csrf ${csrfResponse.status}`);
	const csrf = await csrfResponse.json();
	const csrfCookie = cookiePair(setCookies(csrfResponse.headers), 'zatiaras_csrf');
	assert(csrf.token && csrfCookie, 'csrf data missing');
	const response = await fetch(`${BASE}/api/veriflogin`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token, Cookie: csrfCookie },
		body: JSON.stringify({ username, password: PASSWORD, branch: BRANCH })
	});
	const body = await response.json().catch(() => null);
	assert(response.ok && body?.success, `${username} login ${response.status}`);
	const sid = cookiePair(setCookies(response.headers), 'zatiaras_sid');
	assert(sid, 'session cookie missing');
	return {
		cookie: `${csrfCookie}; ${sid}`,
		csrf: csrf.token,
		user: body.user,
		status: response.status
	};
}
async function jsonRequest(path, { method = 'GET', auth, body } = {}) {
	const headers = { 'Cache-Control': 'no-cache' };
	if (auth) {
		headers.Cookie = auth.cookie;
		headers['X-CSRF-Token'] = auth.csrf;
	}
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	return {
		status: response.status,
		ok: response.ok,
		body: await response.json().catch(() => null)
	};
}
function rows(value) {
	if (Array.isArray(value)) return value;
	if (Array.isArray(value?.data)) return value.data;
	if (Array.isArray(value?.items)) return value.items;
	return [];
}

class SocketClient {
	constructor(socket) {
		this.socket = socket;
		this.buffer = Buffer.alloc(0);
		this.listeners = new Set();
		socket.on('data', (chunk) => this.data(chunk));
	}
	data(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (this.buffer.length >= 2) {
			const op = this.buffer[0] & 15;
			let len = this.buffer[1] & 127,
				off = 2;
			if (len === 126) {
				if (this.buffer.length < 4) return;
				len = this.buffer.readUInt16BE(2);
				off = 4;
			} else if (len === 127) {
				if (this.buffer.length < 10) return;
				len = Number(this.buffer.readBigUInt64BE(2));
				off = 10;
			}
			if (this.buffer.length < off + len) return;
			const payload = this.buffer.subarray(off, off + len);
			this.buffer = this.buffer.subarray(off + len);
			if (op === 1) for (const fn of this.listeners) fn(payload.toString('utf8'));
			if (op === 8) {
				this.close();
				return;
			}
		}
	}
	wait(predicate, label) {
		return new Promise((resolvePromise, reject) => {
			const timer = setTimeout(() => {
				this.listeners.delete(onMessage);
				reject(new Error(`${label} realtime timeout`));
			}, 12000);
			const onMessage = (raw) => {
				if (raw === 'pong') return;
				let body;
				try {
					body = JSON.parse(raw);
				} catch {
					return;
				}
				if (!predicate(body)) return;
				clearTimeout(timer);
				this.listeners.delete(onMessage);
				resolvePromise(body);
			};
			this.listeners.add(onMessage);
		});
	}
	close() {
		this.socket.end();
	}
}
function connectWebSocket(label, cookie) {
	const url = new URL(
		`${BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/api/realtime?branch=${encodeURIComponent(BRANCH)}`
	);
	return new Promise((resolvePromise, reject) => {
		const port = Number(url.port || (url.protocol === 'wss:' ? 443 : 80));
		const socket =
			url.protocol === 'wss:'
				? tls.connect({ host: url.hostname, port, servername: url.hostname })
				: net.connect({ host: url.hostname, port });
		const timer = setTimeout(() => {
			socket.destroy();
			reject(new Error(`${label} websocket open timeout`));
		}, 12000);
		let pending = Buffer.alloc(0);
		socket.once('connect', () => {
			const key = randomBytes(16).toString('base64');
			socket.write(
				[
					`GET ${url.pathname}${url.search} HTTP/1.1`,
					`Host: ${url.host}`,
					'Upgrade: websocket',
					'Connection: Upgrade',
					`Sec-WebSocket-Key: ${key}`,
					'Sec-WebSocket-Version: 13',
					`Cookie: ${cookie}`,
					'\r\n'
				].join('\r\n')
			);
		});
		const onData = (chunk) => {
			pending = Buffer.concat([pending, chunk]);
			const marker = pending.indexOf('\r\n\r\n');
			if (marker < 0) return;
			socket.off('data', onData);
			const head = pending.subarray(0, marker).toString('utf8');
			if (!head.startsWith('HTTP/1.1 101')) {
				clearTimeout(timer);
				socket.destroy();
				reject(new Error(`${label} websocket rejected`));
				return;
			}
			clearTimeout(timer);
			const client = new SocketClient(socket);
			const rest = pending.subarray(marker + 4);
			if (rest.length) client.data(rest);
			resolvePromise(client);
		};
		socket.on('data', onData);
		socket.once('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}

async function wrapperJson(args, label) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn('rtk', ['node', WRAPPER, ...args], {
			cwd: ROOT,
			shell: false,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let out = '',
			err = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (c) => (out += c));
		child.stderr.on('data', (c) => (err += c));
		child.on('error', reject);
		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`${label} failed: ${err.slice(-500)}`));
				return;
			}
			try {
				const line = out
					.trim()
					.split(/\r?\n/)
					.reverse()
					.find((x) => x.startsWith('{'));
				const parsed = JSON.parse(line);
				resolvePromise(parsed);
			} catch (error) {
				reject(new Error(`${label} output unreadable: ${error.message}`));
			}
		});
	});
}
async function wrapperResidue(journal) {
	const parsed = await wrapperJson(
		[
			'query',
			`zatiaras-${journal.branch}-group`,
			'Q_IDEMPOTENCY_RESIDUE',
			journal.branch,
			journal.idempotency_key
		],
		'D1 residue query'
	);
	return Number(parsed.rows?.[0]?.residue_count || 0);
}
async function wrapperResolve(journal) {
	const parsed = await wrapperJson(
		['resolve-transaction', journal.branch, journal.idempotency_key],
		'D1 transaction resolution'
	);
	return parsed.transaction_id || null;
}
async function cleanup(journal, owner) {
	let transactionId = journal?.transaction_id || (await wrapperResolve(journal));
	if (!transactionId) {
		const residue = await wrapperResidue(journal);
		assert(residue === 0, 'unresolved idempotency residue remains');
		const cleaned = {
			...journal,
			status: 'cleaned',
			cleaned_at: new Date().toISOString(),
			cleanup_classification: 'no-transaction-committed',
			residue: { transactions: 0, ledger: 0, idempotency: 0 }
		};
		await atomicJournal(cleaned);
		return cleaned;
	}
	if (!journal.transaction_id) {
		journal = { ...journal, transaction_id: transactionId, status: 'resolved' };
		await atomicJournal(journal);
	}
	const deletion = await jsonRequest(
		`/api/transaksi-kasir?transaction_id=${encodeURIComponent(transactionId)}`,
		{ method: 'DELETE', auth: owner }
	);
	assert(deletion.ok, `cleanup DELETE ${deletion.status}`);
	const [transactions, ledger, residue] = await Promise.all([
		jsonRequest(`/api/transaksi-kasir?transaction_id=${encodeURIComponent(transactionId)}`, {
			auth: owner
		}),
		jsonRequest(`/api/buku-kas?transaction_id=${encodeURIComponent(transactionId)}`, {
			auth: owner
		}),
		wrapperResidue(journal)
	]);
	assert(transactions.ok && rows(transactions.body).length === 0, 'transaction residue remains');
	assert(ledger.ok && rows(ledger.body).length === 0, 'ledger residue remains');
	assert(residue === 0, 'idempotency residue remains');
	const cleaned = {
		...journal,
		status: 'cleaned',
		cleaned_at: new Date().toISOString(),
		residue: { transactions: 0, ledger: 0, idempotency: 0 }
	};
	await atomicJournal(cleaned);
	return cleaned;
}

async function runApi() {
	const existing = await readJournal();
	if (existing && existing.status !== 'cleaned') {
		const owner = await login('pemilik');
		await cleanup(existing, owner);
	}
	const publicMatrix = {};
	for (const path of ['/', '/login'])
		publicMatrix[path] = (
			await fetch(`${BASE}${path}`, { headers: { 'Cache-Control': 'no-cache' } })
		).status;
	for (const path of [
		'/api/produk?branch=samarinda',
		'/api/pos/catalog?branch=samarinda',
		'/api/realtime?branch=samarinda'
	])
		publicMatrix[path] = (
			await fetch(`${BASE}${path}`, { headers: { 'Cache-Control': 'no-cache' } })
		).status;
	assert(
		publicMatrix['/'] === 200 && publicMatrix['/login'] === 200,
		'public page status mismatch'
	);
	assert(
		publicMatrix['/api/produk?branch=samarinda'] === 401 &&
			publicMatrix['/api/pos/catalog?branch=samarinda'] === 401 &&
			publicMatrix['/api/realtime?branch=samarinda'] === 401,
		'unauthenticated guard mismatch'
	);
	const cashier = await login('kasir'),
		owner = await login('pemilik');
	const cross = await jsonRequest('/api/produk?branch=balikpapan', { auth: cashier });
	assert(cross.status === 403, `cross-branch guard ${cross.status}`);
	const guard1 = await jsonRequest('/api/transaksi-kasir', {
		method: 'POST',
		auth: cashier,
		body: { payload: { id: 'rejected', sumber: 'pos' } }
	});
	assert(guard1.status === 409, `transaction direct-write guard ${guard1.status}`);
	const guard2 = await jsonRequest('/api/buku-kas', {
		method: 'POST',
		auth: owner,
		body: {
			payload: {
				id: 'rejected',
				waktu: new Date().toISOString(),
				sumber: 'pos',
				tipe: 'masuk',
				jenis: 'penjualan',
				nominal: 1
			}
		}
	});
	assert(guard2.status === 409, `ledger direct-write guard ${guard2.status}`);
	const product = await jsonRequest(`/api/produk?branch=${BRANCH}`, { auth: cashier });
	assert(
		product.ok && rows(product.body).some((item) => item.id === 'uat-produk-es-teh'),
		'UAT product missing'
	);
	const sockets = await Promise.all([
		connectWebSocket('A', cashier.cookie),
		connectWebSocket('B', cashier.cookie)
	]);
	const key = `uat-by1-${Date.now()}-${randomBytes(5).toString('hex')}`;
	let journal = {
		branch: BRANCH,
		idempotency_key: key,
		status: 'pending',
		created_at: new Date().toISOString()
	};
	await atomicJournal(journal);
	try {
		const items = [{ product_id: 'uat-produk-es-teh', jumlah: 1, add_on_ids: [] }];
		const quote = await jsonRequest('/api/pos/quote', {
			method: 'POST',
			auth: cashier,
			body: { items }
		});
		assert(quote.ok && quote.body?.quote_token, `quote ${quote.status}`);
		const payload = {
			idempotency_key: key,
			nama_pelanggan: 'UAT',
			metode_bayar: 'tunai',
			cash_received: 10000,
			items,
			mode: 'online',
			quote_token: quote.body.quote_token
		};
		const predicate = (message) =>
			message.branch_id === BRANCH && message.table === 'buku_kas' && message.action === 'insert';
		const waits = sockets.map((socket, index) => socket.wait(predicate, `socket ${index + 1}`));
		let checkout = await jsonRequest('/api/pos/transaction', {
			method: 'POST',
			auth: cashier,
			body: payload
		}).catch(() => null);
		if (!checkout?.ok)
			checkout = await jsonRequest('/api/pos/transaction', {
				method: 'POST',
				auth: cashier,
				body: payload
			});
		let transactionId = checkout?.body?.data?.transaction_id;
		if (!transactionId) transactionId = await wrapperResolve(journal);
		assert(transactionId, 'checkout transaction id missing');
		journal = {
			...journal,
			status: 'committed',
			transaction_id: transactionId,
			committed_at: new Date().toISOString()
		};
		await atomicJournal(journal);
		await Promise.all(waits);
		return {
			matrix: {
				...publicMatrix,
				login: 200,
				cross_branch: 403,
				direct_transaction: 409,
				direct_ledger: 409
			},
			realtimeClients: 2,
			journal,
			owner
		};
	} catch (error) {
		throw error;
	} finally {
		sockets.forEach((socket) => socket.close());
	}
}

async function browserLogin(page, username) {
	await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
	await page.locator('form[data-hydrated="true"]').waitFor({ timeout: 60000 });
	await page.locator('#username').fill(username);
	await page.locator('#password').fill(PASSWORD);
	await page.locator('select[aria-label="Pilih Cabang"]').selectOption(BRANCH);
	await page.locator('button[type="submit"]').click();
	await page.waitForFunction(
		async (expected) => {
			const response = await fetch('/api/session', { credentials: 'include' });
			const session = await response.json();
			return session.authenticated && session.user?.username === expected;
		},
		username,
		{ timeout: 20000 }
	);
}

async function dashboardMetrics(page) {
	return page.evaluate(() => {
		const text = document.body.innerText;
		const read = (label) => {
			const index = text.indexOf(label);
			const match =
				index < 0
					? null
					: text.slice(index + label.length, index + label.length + 80).match(/[0-9][0-9.]*/);
			return match ? Number(match[0].replace(/\./g, '')) : 0;
		};
		return {
			items: read('Item Terjual'),
			transactions: read('Jumlah Transaksi'),
			revenue: read('Pendapatan')
		};
	});
}

async function runBrowser() {
	const { chromium } = await import('@playwright/test');
	let browser;
	let journal;
	let checkoutStarted = false;
	try {
		browser = await chromium.launch({
			headless: true,
			executablePath:
				process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
		});
		const ownerContext = await browser.newContext();
		const cashierContext = await browser.newContext();
		const ownerPage = await ownerContext.newPage();
		const cashierPage = await cashierContext.newPage();
		await Promise.all([browserLogin(ownerPage, 'pemilik'), browserLogin(cashierPage, 'kasir')]);
		await ownerPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
		await ownerPage
			.getByText('Jumlah Transaksi', { exact: false })
			.first()
			.waitFor({ timeout: 20000 });
		const before = await dashboardMetrics(ownerPage);
		await cashierPage.evaluate((branch) => localStorage.setItem('selectedBranch', branch), BRANCH);
		const key = `uat-by1-browser-${Date.now()}-${randomBytes(4).toString('hex')}`;
		await cashierPage.route('**/api/pos/transaction', async (route) => {
			assert(!checkoutStarted, 'browser attempted more than one checkout');
			checkoutStarted = true;
			const original = route.request().postDataJSON();
			journal = {
				branch: BRANCH,
				idempotency_key: key,
				status: 'pending',
				created_at: new Date().toISOString(),
				mode: 'browser'
			};
			await atomicJournal(journal);
			const response = await route.fetch({
				postData: JSON.stringify({ ...original, idempotency_key: key })
			});
			const payload = await response.json().catch(() => null);
			const transactionId = payload?.data?.transaction_id;
			assert(response.ok() && transactionId, `browser checkout ${response.status()}`);
			journal = {
				...journal,
				status: 'committed',
				transaction_id: transactionId,
				committed_at: new Date().toISOString()
			};
			await atomicJournal(journal);
			await route.fulfill({ response });
		});
		await cashierPage.goto(`${BASE}/pos`, { waitUntil: 'domcontentloaded' });
		try {
			await cashierPage
				.locator('[aria-label*="Tambah Es Teh UAT ke keranjang"]')
				.first()
				.waitFor({ timeout: 20000 });
		} catch {
			const debug = await cashierPage.evaluate(async (branch) => {
				const session = await fetch('/api/session', { credentials: 'include' }).then((response) =>
					response.json()
				);
				const products = await fetch(`/api/produk?branch=${encodeURIComponent(branch)}`, {
					credentials: 'include'
				});
				const productRows = await products.json().catch(() => []);
				const text = document.body.innerText;
				return {
					path: location.pathname,
					selectedBranch: localStorage.getItem('selectedBranch'),
					authenticated: Boolean(session.authenticated),
					productStatus: products.status,
					productCount: Array.isArray(productRows) ? productRows.length : 0,
					showsUnauthorized: /tidak berwenang|unauthorized/i.test(text),
					showsSessionClosed: /sesi.*tutup|buka sesi/i.test(text)
				};
			}, BRANCH);
			throw new Error(`browser POS pre-check failed: ${JSON.stringify(debug)}`);
		}
		await cashierPage.locator('[aria-label*="Tambah Es Teh UAT ke keranjang"]').first().click();
		await cashierPage.getByRole('button', { name: 'Tambah ke Keranjang' }).click();
		await cashierPage.getByRole('button', { name: 'Bayar', exact: true }).click();
		await cashierPage.waitForURL('**/pos/bayar', { timeout: 10000 });
		await cashierPage
			.locator('input[placeholder="Masukkan nama pelanggan..."]')
			.fill('UAT Browser');
		await cashierPage.getByRole('button', { name: 'Tunai', exact: true }).click();
		await cashierPage.getByRole('button', { name: /Konfirmasi/ }).click();
		await cashierPage.getByRole('button', { name: /Rp 10\.000/ }).click();
		await cashierPage.getByRole('button', { name: 'Selesai', exact: true }).click();
		await cashierPage.getByText('Transaksi Berhasil', { exact: false }).waitFor({ timeout: 20000 });
		assert(journal?.transaction_id, 'browser transaction was not journaled');
		await ownerPage.waitForFunction(
			async (snapshot) => {
				const text = document.body.innerText;
				const read = (label) => {
					const index = text.indexOf(label);
					const match =
						index < 0
							? null
							: text.slice(index + label.length, index + label.length + 80).match(/[0-9][0-9.]*/);
					return match ? Number(match[0].replace(/\./g, '')) : 0;
				};
				return (
					read('Jumlah Transaksi') > snapshot.transactions ||
					read('Pendapatan') > snapshot.revenue ||
					read('Item Terjual') > snapshot.items
				);
			},
			before,
			{ timeout: 20000 }
		);
		return { ok: true, browserCheckout: 'PASS', ownerRealtimeDashboard: 'PASS' };
	} finally {
		await browser?.close();
	}
}

let result;
try {
	result = MODE === 'browser' ? await runBrowser() : await runApi();
} finally {
	const pending = await readJournal();
	if (pending && pending.status !== 'cleaned') {
		const owner = result?.owner || (await login('pemilik'));
		await cleanup(pending, owner);
	}
}
const finalJournal = await readJournal();
assert(finalJournal?.status === 'cleaned', 'journal not cleaned');
console.log(
	JSON.stringify({
		ok: true,
		baseUrl: BASE,
		branch: BRANCH,
		...(MODE === 'browser'
			? {
					browserCheckout: result.browserCheckout,
					ownerRealtimeDashboard: result.ownerRealtimeDashboard
				}
			: { matrix: result.matrix, realtimeClientsVerified: result.realtimeClients }),
		cleanup: 'PASS',
		residue: finalJournal.residue,
		browser: MODE === 'browser' ? 'PASS' : 'NOT_RUN'
	})
);
