import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

const baseUrl = (process.argv[2] || 'https://zatiaraspos.pages.dev').replace(/\/$/, '');
const branch = process.argv[3] || 'samarinda';
const password = process.env.UAT_PASSWORD || 'zatiaras123';

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
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

async function postData(body, cookie) {
	const response = await fetch(`${baseUrl}/api/data`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: cookie
		},
		body: JSON.stringify(body)
	});
	const json = await response.json().catch(() => null);
	assert(response.ok, `POST /api/data failed: ${response.status} ${JSON.stringify(json)}`);
	return json;
}

async function postPosTransaction(body, cookie) {
	const response = await fetch(`${baseUrl}/api/pos/transaction`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: cookie
		},
		body: JSON.stringify(body)
	});
	const json = await response.json().catch(() => null);
	assert(
		response.ok,
		`POST /api/pos/transaction failed: ${response.status} ${JSON.stringify(json)}`
	);
	return json;
}

class RawWebSocket {
	constructor(socket) {
		this.socket = socket;
		this.listeners = new Map();
		this.buffer = Buffer.alloc(0);
		socket.on('data', (chunk) => this.onData(chunk));
		socket.on('close', () => this.emit('close', { code: 1006 }));
		socket.on('error', (error) => this.emit('error', error));
	}

	addEventListener(type, callback) {
		const callbacks = this.listeners.get(type) || new Set();
		callbacks.add(callback);
		this.listeners.set(type, callbacks);
	}

	removeEventListener(type, callback) {
		this.listeners.get(type)?.delete(callback);
	}

	emit(type, event) {
		for (const callback of this.listeners.get(type) || []) callback(event);
	}

	onData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (this.buffer.length >= 2) {
			const first = this.buffer[0];
			const second = this.buffer[1];
			const opcode = first & 0x0f;
			let length = second & 0x7f;
			let offset = 2;
			if (length === 126) {
				if (this.buffer.length < 4) return;
				length = this.buffer.readUInt16BE(2);
				offset = 4;
			} else if (length === 127) {
				if (this.buffer.length < 10) return;
				const largeLength = this.buffer.readBigUInt64BE(2);
				if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Frame too large');
				length = Number(largeLength);
				offset = 10;
			}
			if (this.buffer.length < offset + length) return;
			const payload = this.buffer.subarray(offset, offset + length);
			this.buffer = this.buffer.subarray(offset + length);
			if (opcode === 1) this.emit('message', { data: payload.toString('utf8') });
			if (opcode === 8) {
				this.close();
				return;
			}
		}
	}

	close() {
		this.socket.end();
	}
}

function openSocket(label, cookie) {
	const wsUrl = new URL(
		`${baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/api/realtime?branch=${encodeURIComponent(branch)}`
	);
	return new Promise((resolve, reject) => {
		const port = Number(wsUrl.port || (wsUrl.protocol === 'wss:' ? 443 : 80));
		const socket =
			wsUrl.protocol === 'wss:'
				? tls.connect({ host: wsUrl.hostname, port, servername: wsUrl.hostname })
				: net.connect({ host: wsUrl.hostname, port });
		const timer = setTimeout(() => reject(new Error(`${label} websocket open timeout`)), 10000);
		const chunks = [];

		socket.once('connect', () => {
			const key = randomBytes(16).toString('base64');
			socket.write(
				[
					`GET ${wsUrl.pathname}${wsUrl.search} HTTP/1.1`,
					`Host: ${wsUrl.host}`,
					'Upgrade: websocket',
					'Connection: Upgrade',
					`Sec-WebSocket-Key: ${key}`,
					'Sec-WebSocket-Version: 13',
					`Cookie: ${cookie}`,
					'\r\n'
				].join('\r\n')
			);
		});

		function onHandshakeData(chunk) {
			chunks.push(chunk);
			const buffer = Buffer.concat(chunks);
			const marker = buffer.indexOf('\r\n\r\n');
			if (marker === -1) return;
			socket.off('data', onHandshakeData);
			const header = buffer.subarray(0, marker).toString('utf8');
			const rest = buffer.subarray(marker + 4);
			if (!header.startsWith('HTTP/1.1 101')) {
				clearTimeout(timer);
				socket.end();
				reject(new Error(`${label} websocket rejected: ${header.split('\r\n')[0]}`));
				return;
			}
			clearTimeout(timer);
			const ws = new RawWebSocket(socket);
			if (rest.length) ws.onData(rest);
			resolve(ws);
		}

		socket.on('data', onHandshakeData);
		socket.once('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}

function waitForMessage(ws, predicate, label) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			ws.removeEventListener('message', onMessage);
			reject(new Error(`${label} realtime message timeout`));
		}, 10000);

		function onMessage(event) {
			if (event.data === 'pong') return;
			const message = JSON.parse(String(event.data));
			if (!predicate(message)) return;
			clearTimeout(timer);
			ws.removeEventListener('message', onMessage);
			resolve(message);
		}

		ws.addEventListener('message', onMessage);
	});
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
	assert(
		loginResponse.ok && loginJson?.success,
		`${username} login failed: ${loginResponse.status}`
	);
	const sidCookie = cookiePair(getSetCookies(loginResponse.headers), 'zatiaras_sid');
	return {
		json: loginJson,
		cookie: [csrfCookie, sidCookie].filter(Boolean).join('; ')
	};
}

const cashierLogin = await login('kasir');
const ownerLogin = await login('pemilik');
const cookie = cashierLogin.cookie;
const ownerCookie = ownerLogin.cookie;

const productResponse = await fetch(
	`${baseUrl}/api/data?table=produk&branch=${encodeURIComponent(branch)}&limit=5`,
	{ headers: { Cookie: cookie } }
);
const products = await productResponse.json();
assert(
	Array.isArray(products) && products.some((item) => item.id === 'uat-produk-es-teh'),
	'UAT product missing'
);

const sockets = await Promise.all([openSocket('A', cookie), openSocket('B', cookie)]);
const idempotencyKey = `uat-live-${Date.now()}`;
let transactionId = idempotencyKey;

const predicate = (message) =>
	message.branch_id === branch && message.table === 'buku_kas' && message.action === 'insert';
const waits = sockets.map((socket, index) =>
	waitForMessage(socket, predicate, `socket ${index + 1}`)
);

try {
	const posResult = await postPosTransaction(
		{
			idempotency_key: idempotencyKey,
			customer_name: 'UAT',
			payment_method: 'tunai',
			cash_received: 10000,
			items: [{ product_id: 'uat-produk-es-teh', qty: 1, add_on_ids: [] }]
		},
		cookie
	);
	transactionId = posResult?.data?.transaction_id || idempotencyKey;
	await Promise.all(waits);
} finally {
	await postData(
		{
			table: 'transaksi_kasir',
			action: 'delete',
			branch,
			payload: {},
			where: { transaction_id: transactionId }
		},
		ownerCookie
	).catch(() => null);
	await postData(
		{
			table: 'buku_kas',
			action: 'delete',
			branch,
			payload: {},
			where: { transaction_id: transactionId }
		},
		ownerCookie
	).catch(() => null);
	for (const socket of sockets) socket.close(1000, 'done');
}

console.log(
	JSON.stringify({
		ok: true,
		baseUrl,
		branch,
		login: cashierLogin.json.user,
		productCount: products.length,
		transactionId,
		realtimeClientsVerified: sockets.length
	})
);
