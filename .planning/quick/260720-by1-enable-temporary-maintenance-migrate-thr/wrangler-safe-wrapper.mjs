import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(
	dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')),
	'../../..'
);
const TASK = resolve(ROOT, '.planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr');
const CONFIG = resolve(ROOT, 'wrangler.pages.jsonc');
const RECOVERY_MANIFEST = resolve(TASK, 'recovery-manifest.json');
const PROJECT = 'zatiaraspos';
const BRANCH = 'main';
const MARKER = 'ZATIARASPOS-MAINT-260720-BY1';
const MIGRATIONS = new Map([
	[
		'0015',
		{
			path: resolve(ROOT, 'drizzle/0015_session_page_unlocks.sql'),
			hash: '12227284f41747cfd3d5ca908132bc9ee05a5e2b413af3579a11e4f81efcfe8d'
		}
	],
	[
		'0016',
		{
			path: resolve(ROOT, 'drizzle/0016_pin_hash.sql'),
			hash: '56fa7512a76dd008b759a369439d10f0d1779a26647f7ca15e209efa2dee650f'
		}
	]
]);
const DATABASES = new Map([
	['zatiaras-samarinda-group', 'b6aafe5b-fd11-436d-9b9e-c007bd531c9e'],
	['zatiaras-balikpapan-group', '312940d7-b0c0-43e5-86fd-78b762cacb6e'],
	['zatiaras-berau-group', '18e2f751-5d54-4bec-b0bc-ae6e1378cdb6']
]);
const QUERY = Object.freeze({
	Q_AUTH_SCHEMA: 'PRAGMA table_info("auth_sessions");',
	Q_SETTINGS_SCHEMA: 'PRAGMA table_info("pengaturan");',
	Q_SETTINGS_INDEX_LIST: 'PRAGMA index_list("pengaturan");',
	Q_SETTINGS_INDEX_INFO: 'PRAGMA index_info("idx_pengaturan_branch");',
	Q_SETTINGS_FKS: 'PRAGMA foreign_key_list("pengaturan");',
	Q_SETTINGS_TEMP_TABLE:
		"SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name = '__new_pengaturan';",
	Q_QUICK_CHECK: 'PRAGMA quick_check;',
	Q_INTEGRITY_CHECK: 'PRAGMA integrity_check;',
	Q_AUTH_UNLOCK_INVALID:
		'SELECT COUNT(*) AS invalid_count FROM auth_sessions WHERE unlocked_pages IS NULL OR unlock_expires_at IS NULL;',
	Q_COUNT_PROFIL:
		"SELECT 'profil' AS table_name, COUNT(*) AS row_count, NULL AS amount_sum FROM profil;",
	Q_COUNT_AUTH_SESSIONS:
		"SELECT 'auth_sessions' AS table_name, COUNT(*) AS row_count, NULL AS amount_sum FROM auth_sessions;",
	Q_COUNT_PENGATURAN:
		"SELECT 'pengaturan' AS table_name, COUNT(*) AS row_count, NULL AS amount_sum FROM pengaturan;",
	Q_COUNT_PRODUK:
		"SELECT 'produk' AS table_name, COUNT(*) AS row_count, NULL AS amount_sum FROM produk;",
	Q_COUNT_SESI_TOKO:
		"SELECT 'sesi_toko' AS table_name, COUNT(*) AS row_count, NULL AS amount_sum FROM sesi_toko;",
	Q_COUNT_BUKU_KAS:
		"SELECT 'buku_kas' AS table_name, COUNT(*) AS row_count, COALESCE(SUM(nominal), 0) AS amount_sum FROM buku_kas;",
	Q_COUNT_TRANSAKSI_KASIR:
		"SELECT 'transaksi_kasir' AS table_name, COUNT(*) AS row_count, COALESCE(SUM(nominal), 0) AS amount_sum FROM transaksi_kasir;",
	Q_SETTINGS_PRE_0016:
		'SELECT id, cabang_id, pin, NULL AS pin_hash, halaman_terkunci, nama_toko, alamat, telepon, instagram, ucapan, created_at, updated_at FROM pengaturan ORDER BY cabang_id, id;',
	Q_SETTINGS_POST_0016:
		'SELECT id, cabang_id, pin, pin_hash, halaman_terkunci, nama_toko, alamat, telepon, instagram, ucapan, created_at, updated_at FROM pengaturan ORDER BY cabang_id, id;',
	Q_FINANCIAL_IDENTITIES:
		"SELECT 'buku_kas' AS source, id, transaction_id, idempotency_key, nominal, created_at FROM buku_kas UNION ALL SELECT 'transaksi_kasir', id, transaction_id, NULL AS idempotency_key, nominal, created_at FROM transaksi_kasir ORDER BY source, id;",
	Q_AUDIT_WINDOW:
		"SELECT id, cabang_id, action, entity_type, entity_id, transaction_id, amount, created_at FROM audit_logs WHERE created_at >= :start_utc AND created_at <= :end_utc AND entity_type IN ('buku_kas', 'transaksi_kasir', 'pengaturan') ORDER BY created_at, id;",
	Q_IDEMPOTENCY_RESIDUE:
		'SELECT COUNT(*) AS residue_count FROM buku_kas WHERE cabang_id = :branch AND idempotency_key = :idempotency_key;',
	Q_TRANSACTION_BY_IDEMPOTENCY:
		'SELECT transaction_id FROM buku_kas WHERE cabang_id = :branch AND idempotency_key = :idempotency_key LIMIT 1;'
});
const SENSITIVE_QUERY_IDS = new Set([
	'Q_FINANCIAL_IDENTITIES',
	'Q_AUDIT_WINDOW',
	'Q_SETTINGS_PRE_0016',
	'Q_SETTINGS_POST_0016',
	'Q_TRANSACTION_BY_IDEMPOTENCY'
]);
const CORE_COUNT_QUERY_IDS = Object.freeze([
	'Q_COUNT_PROFIL',
	'Q_COUNT_AUTH_SESSIONS',
	'Q_COUNT_PENGATURAN',
	'Q_COUNT_PRODUK',
	'Q_COUNT_SESI_TOKO',
	'Q_COUNT_BUKU_KAS',
	'Q_COUNT_TRANSAKSI_KASIR'
]);

function fail(message) {
	throw new Error(message);
}
function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}
function assert(condition, message) {
	if (!condition) fail(message);
}
function quoteSql(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}
function validRfc3339(value) {
	return (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}
function validBookmark(value) {
	return /^[A-Za-z0-9._~:+/-]{8,512}$/.test(value);
}
function validUatKey(value) {
	return /^uat-by1-[A-Za-z0-9-]{8,96}$/.test(value);
}

async function loadEnvironment() {
	const env = { ...process.env };
	let text = '';
	try {
		text = await readFile(resolve(ROOT, '.env'), 'utf8');
	} catch {
		return { env, secrets: [] };
	}
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		)
			value = value.slice(1, -1);
		env[match[1]] ??= value;
	}
	const secrets = Object.entries(env)
		.filter(
			([key, value]) =>
				/TOKEN|SECRET|PASSWORD|KEY|COOKIE|PIN/i.test(key) &&
				typeof value === 'string' &&
				value.length >= 6
		)
		.map(([, value]) => value);
	return { env, secrets };
}

function redact(text, secrets) {
	let safe = String(text);
	for (const secret of secrets) safe = safe.split(secret).join('[REDACTED]');
	return safe;
}

async function runWrangler(args, { json = false, quiet = false } = {}) {
	assert(Array.isArray(args) && args.every((arg) => typeof arg === 'string'), 'argv invalid');
	const { env, secrets } = await loadEnvironment();
	const result = await new Promise((resolvePromise, reject) => {
		const child = spawn('rtk', ['pnpm', 'exec', 'wrangler', ...args], {
			cwd: ROOT,
			env,
			shell: false,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '',
			stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
	});
	for (const secret of secrets)
		assert(
			!result.stdout.includes(secret) && !result.stderr.includes(secret),
			'secret leak detected'
		);
	if (result.code !== 0)
		fail(
			`Wrangler failed (${result.code}): ${redact(`${result.stderr}\n${result.stdout}`, secrets).slice(-3000)}`
		);
	if (json) return parseJsonOutput(result.stdout);
	if (quiet) return result.stdout;
	return redact(result.stdout, secrets);
}

async function runLocal(args) {
	assert(Array.isArray(args) && args.every((arg) => typeof arg === 'string'), 'local argv invalid');
	return new Promise((resolvePromise, reject) => {
		const child = spawn('rtk', args, {
			cwd: ROOT,
			shell: false,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.on('error', reject);
		child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
	});
}

function parseJsonOutput(text) {
	const clean = String(text)
		.replace(/^\[rtk\].*$/gm, '')
		.trim();
	for (let i = 0; i < clean.length; i += 1) {
		if (clean[i] !== '{' && clean[i] !== '[') continue;
		try {
			return JSON.parse(clean.slice(i));
		} catch {
			/* next candidate */
		}
	}
	fail('Wrangler JSON output unreadable');
}

function rowsFrom(value) {
	const found = [];
	const visit = (node) => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node.results)) found.push(...node.results);
		for (const child of Object.values(node)) if (child && typeof child === 'object') visit(child);
	};
	visit(value);
	return found;
}

async function validateConfig() {
	const parsed = JSON.parse(await readFile(CONFIG, 'utf8'));
	assert(parsed.name === PROJECT, 'Pages project config mismatch');
	const actual = new Map(
		(parsed.d1_databases || []).map((entry) => [entry.database_name, entry.database_id])
	);
	assert(actual.size === DATABASES.size, 'D1 config count mismatch');
	for (const [name, id] of DATABASES)
		assert(actual.get(name) === id, `D1 identity mismatch: ${name}`);
}

async function readValidatedRecoveryManifest() {
	const before = await readFile(RECOVERY_MANIFEST);
	if (process.platform === 'win32') {
		const acl = await runLocal(['icacls', RECOVERY_MANIFEST]);
		assert(acl.code === 0, 'recovery manifest ACL read failed');
		const normalized = acl.stdout.replaceAll('/', '\\').toLowerCase();
		const username = userInfo().username.toLowerCase();
		assert(!normalized.includes('(i)'), 'recovery manifest inherited ACL rejected');
		assert(normalized.includes('system:(f)'), 'recovery manifest SYSTEM ACL missing');
		assert(
			normalized.includes(`\\${username}:(f)`) || normalized.includes(` ${username}:(f)`),
			'recovery manifest current-user ACL missing'
		);
		assert(
			(normalized.match(/\(f\)/g) || []).length === 2,
			'recovery manifest ACL is not exclusive'
		);
	} else {
		const metadata = await stat(RECOVERY_MANIFEST);
		assert((metadata.mode & 0o077) === 0, 'recovery manifest permissions are too broad');
	}
	const after = await readFile(RECOVERY_MANIFEST);
	assert(before.equals(after), 'recovery manifest changed during ACL/readback validation');
	const manifest = JSON.parse(after.toString('utf8'));
	assert(
		manifest.schema_version === 1 &&
			manifest.restore_executed === false &&
			Array.isArray(manifest.entries) &&
			manifest.entries.length === DATABASES.size,
		'recovery manifest schema rejected'
	);
	for (const entry of manifest.entries) {
		assert(
			DATABASES.get(entry.database_name) === entry.database_id,
			'recovery database identity rejected'
		);
		assert(entry.version === 'production', 'recovery database version rejected');
		assert(validRfc3339(entry.timestamp), 'recovery timestamp rejected');
		assert(validRfc3339(entry.conservative_restore_deadline), 'recovery deadline rejected');
		assert(
			Date.parse(entry.conservative_restore_deadline) - Date.parse(entry.timestamp) ===
				7 * 86400000,
			'recovery deadline interval rejected'
		);
		assert(validBookmark(entry.bookmark), 'recovery bookmark rejected');
	}
	return manifest;
}

function parseRestoreRequest(args) {
	assert(
		args.length === 6 &&
			args[0] === '--database' &&
			args[2] === '--bookmark' &&
			args[4] === '--confirm-bookmark',
		'restore args rejected'
	);
	assert(validBookmark(args[3]) && args[5] === args[3], 'restore bookmark confirmation rejected');
	return { database: args[1], bookmark: args[3] };
}

function buildRestorePlan({ args, manifest, approval, interactive, now = Date.now() }) {
	const request = parseRestoreRequest(args);
	const entry = manifest.entries.find((candidate) => candidate.database_name === request.database);
	assert(entry, 'restore database is absent from recovery manifest');
	assert(DATABASES.get(request.database) === entry.database_id, 'restore database UUID mismatch');
	assert(request.bookmark === entry.bookmark, 'restore bookmark does not match recovery manifest');
	const deadline = Date.parse(entry.conservative_restore_deadline);
	assert(Number.isFinite(deadline), 'restore deadline invalid');
	assert(now <= deadline, 'restore deadline expired; obtain a fresh recovery decision');
	assert(approval === 'YES', 'restore denied: ALLOW_D1_TIME_TRAVEL_RESTORE must equal YES');
	assert(interactive === true, 'restore denied: real interactive TTY required');
	const confirmation = `RESTORE ${request.database} ${request.bookmark}`;
	return {
		database: request.database,
		bookmark: request.bookmark,
		deadline: entry.conservative_restore_deadline,
		confirmation,
		argv: [
			'd1',
			'time-travel',
			'restore',
			request.database,
			'--bookmark',
			request.bookmark,
			'--config',
			CONFIG,
			'--json'
		]
	};
}

function requireTypedRestoreConfirmation(plan, typed) {
	assert(typed === plan.confirmation, 'restore typed confirmation mismatch');
}

function expectDenied(callback, message) {
	let denied = false;
	try {
		callback();
	} catch {
		denied = true;
	}
	assert(denied, message);
}

function requireDatabase(name) {
	assert(DATABASES.has(name), 'database rejected');
	return name;
}
async function requirePath(path, expected) {
	assert((await realpath(path)) === (await realpath(expected)), 'path rejected');
}

function buildQuery(id, params = {}) {
	assert(Object.hasOwn(QUERY, id), 'query ID rejected');
	let sql = QUERY[id];
	if (id === 'Q_AUDIT_WINDOW') {
		assert(
			validRfc3339(params.start_utc) && validRfc3339(params.end_utc),
			'audit timestamp rejected'
		);
		assert(Date.parse(params.start_utc) <= Date.parse(params.end_utc), 'audit range rejected');
		sql = sql
			.replace(':start_utc', quoteSql(params.start_utc))
			.replace(':end_utc', quoteSql(params.end_utc));
	} else if (id === 'Q_IDEMPOTENCY_RESIDUE' || id === 'Q_TRANSACTION_BY_IDEMPOTENCY') {
		assert(['samarinda', 'balikpapan', 'berau'].includes(params.branch), 'branch rejected');
		assert(validUatKey(params.idempotency_key), 'idempotency key rejected');
		sql = sql
			.replace(':branch', quoteSql(params.branch))
			.replace(':idempotency_key', quoteSql(params.idempotency_key));
	} else assert(Object.keys(params).length === 0, 'query parameters rejected');
	return sql;
}

async function query(database, id, params = {}) {
	requireDatabase(database);
	const sql = buildQuery(id, params);
	const json = await runWrangler(
		['d1', 'execute', database, '--remote', '--config', CONFIG, '--command', sql, '--json'],
		{ json: true, quiet: true }
	);
	return rowsFrom(json);
}

async function queryCoreCounts(database) {
	const groups = await Promise.all(CORE_COUNT_QUERY_IDS.map((id) => query(database, id)));
	const rows = groups.flat();
	assert(rows.length === CORE_COUNT_QUERY_IDS.length, 'core count query shape mismatch');
	const expectedTables = [
		'profil',
		'auth_sessions',
		'pengaturan',
		'produk',
		'sesi_toko',
		'buku_kas',
		'transaksi_kasir'
	];
	assert(
		rows.every(
			(row, index) =>
				row.table_name === expectedTables[index] &&
				Number.isFinite(Number(row.row_count)) &&
				(row.amount_sum === null || Number.isFinite(Number(row.amount_sum)))
		),
		'core count result rejected'
	);
	return rows;
}

function typed(value) {
	if (value === null) return 'n:0:';
	if (typeof value === 'number') {
		const data = Number.isFinite(value) ? String(value) : fail('nonfinite number');
		return `d:${Buffer.byteLength(data)}:${data}`;
	}
	if (typeof value === 'string') return `s:${Buffer.byteLength(value)}:${value}`;
	const data = JSON.stringify(value);
	return `j:${Buffer.byteLength(data)}:${data}`;
}
function canonical(rows) {
	return rows
		.map((row) =>
			Object.keys(row)
				.map((key) => `${typed(key)}${typed(row[key])}`)
				.join('')
		)
		.join('');
}
function keyed(rows, key) {
	return createHmac('sha256', key).update(canonical(rows)).digest();
}
function sameBuffer(left, right) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function secureEvidence(label, rows, callback) {
	const dir = await mkdtemp(join(tmpdir(), `zatiaras-${label}-`));
	const path = join(dir, 'evidence.json');
	try {
		await writeFile(path, JSON.stringify(rows), { mode: 0o600, flag: 'wx' });
		return await callback(path);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

function schemaMap(rows) {
	return new Map(rows.map((row) => [row.name, row]));
}
function classify0015(rows) {
	const map = schemaMap(rows);
	const a = map.get('unlocked_pages');
	const b = map.get('unlock_expires_at');
	if (!a && !b) return 'missing';
	if (
		a &&
		b &&
		String(a.type).toUpperCase() === 'TEXT' &&
		Number(a.notnull) === 1 &&
		String(a.dflt_value).replaceAll('"', "'") === "'[]'" &&
		String(b.type).toUpperCase() === 'INTEGER' &&
		Number(b.notnull) === 1 &&
		String(b.dflt_value) === '0'
	)
		return 'applied';
	return 'partial';
}
function validateSettingsSchema(rows) {
	const expected = [
		['id', 'INTEGER', 1, null, 1],
		['cabang_id', 'TEXT', 1, null, 0],
		['pin', 'TEXT', 0, null, 0],
		['pin_hash', 'TEXT', 0, null, 0],
		['halaman_terkunci', 'TEXT', 0, "'[]'", 0],
		['nama_toko', 'TEXT', 0, null, 0],
		['alamat', 'TEXT', 0, null, 0],
		['telepon', 'TEXT', 0, null, 0],
		['instagram', 'TEXT', 0, null, 0],
		['ucapan', 'TEXT', 0, null, 0],
		['created_at', 'TEXT', 0, 'CURRENT_TIMESTAMP', 0],
		['updated_at', 'TEXT', 0, 'CURRENT_TIMESTAMP', 0]
	];
	return (
		rows.length === expected.length &&
		expected.every(([name, type, notnull, dflt, pk], index) => {
			const row = rows[index];
			return (
				row?.name === name &&
				String(row.type).toUpperCase() === type &&
				Number(row.notnull) === notnull &&
				(row.dflt_value ?? null) === dflt &&
				Number(row.pk) === pk
			);
		})
	);
}
function validatePre0016SettingsSchema(rows) {
	const expected = [
		['id', 'INTEGER', 1, null, 1],
		['cabang_id', 'TEXT', 1, null, 0],
		['pin', 'TEXT', 0, "'1234'", 0],
		['halaman_terkunci', 'TEXT', 0, "'[]'", 0],
		['nama_toko', 'TEXT', 0, null, 0],
		['alamat', 'TEXT', 0, null, 0],
		['telepon', 'TEXT', 0, null, 0],
		['instagram', 'TEXT', 0, null, 0],
		['ucapan', 'TEXT', 0, null, 0],
		['created_at', 'TEXT', 0, 'CURRENT_TIMESTAMP', 0],
		['updated_at', 'TEXT', 0, 'CURRENT_TIMESTAMP', 0]
	];
	return (
		rows.length === expected.length &&
		expected.every(([name, type, notnull, dflt, pk], index) => {
			const row = rows[index];
			return (
				row?.name === name &&
				String(row.type).toUpperCase() === type &&
				Number(row.notnull) === notnull &&
				(row.dflt_value ?? null) === dflt &&
				Number(row.pk) === pk
			);
		})
	);
}
function classify0016(schema, indexes, indexInfo, fks, temp) {
	const hasPinHash = schema.some((row) => row.name === 'pin_hash');
	const hasIndex =
		indexes.some((row) => row.name === 'idx_pengaturan_branch' && Number(row.unique) === 0) &&
		indexInfo.length === 1 &&
		indexInfo[0]?.name === 'cabang_id';
	const noTemp = Number(temp[0]?.table_count) === 0;
	if (validateSettingsSchema(schema) && hasIndex && fks.length === 0 && noTemp) return 'applied';
	if (!hasPinHash && validatePre0016SettingsSchema(schema) && fks.length === 0 && noTemp)
		return 'missing';
	return 'partial';
}
async function migrationFile(tag) {
	const migration = MIGRATIONS.get(tag);
	assert(migration, 'migration rejected');
	await requirePath(migration.path, migration.path);
	assert(sha256(await readFile(migration.path)) === migration.hash, 'migration hash mismatch');
	return migration;
}
async function executeMigration(database, tag) {
	const migration = await migrationFile(tag);
	await runWrangler(
		[
			'd1',
			'execute',
			database,
			'--remote',
			'--config',
			CONFIG,
			'--file',
			migration.path,
			'--yes',
			'--json'
		],
		{ json: true, quiet: true }
	);
}

function identityKey(row) {
	return `${row.source}\u0000${row.id}`;
}
function compareFinancial(before, after, audits) {
	const oldMap = new Map(before.map((row) => [identityKey(row), canonical([row])]));
	const newMap = new Map(after.map((row) => [identityKey(row), canonical([row])]));
	for (const [key, value] of oldMap)
		if (newMap.get(key) !== value)
			return { verdict: 'FAIL', reason: 'preexisting financial identity changed or disappeared' };
	const appended = [...newMap.keys()].filter((key) => !oldMap.has(key));
	if (appended.length === 0) return { verdict: 'PASS', delta: 0, auditRows: audits.length };
	const distinct = new Set(
		after
			.filter((row) => appended.includes(identityKey(row)))
			.map((row) => row.idempotency_key)
			.filter(Boolean)
	);
	if (
		distinct.size !==
		after.filter((row) => appended.includes(identityKey(row)) && row.idempotency_key).length
	)
		return { verdict: 'FAIL', reason: 'duplicate appended idempotency identity' };
	if (audits.length === 0)
		return {
			verdict: 'INCONCLUSIVE',
			reason: 'append without same-window audit',
			delta: appended.length
		};
	return {
		verdict: 'PASS',
		delta: appended.length,
		auditRows: audits.length,
		classified: 'old-host traffic'
	};
}

async function auditShardReadOnly(database) {
	requireDatabase(database);
	const started = new Date().toISOString();
	const [auth, settings, indexes, indexInfo, fks, temp, core, financial] = await Promise.all([
		query(database, 'Q_AUTH_SCHEMA'),
		query(database, 'Q_SETTINGS_SCHEMA'),
		query(database, 'Q_SETTINGS_INDEX_LIST'),
		query(database, 'Q_SETTINGS_INDEX_INFO'),
		query(database, 'Q_SETTINGS_FKS'),
		query(database, 'Q_SETTINGS_TEMP_TABLE'),
		queryCoreCounts(database),
		query(database, 'Q_FINANCIAL_IDENTITIES')
	]);
	const status15 = classify0015(auth);
	const status16 = classify0016(settings, indexes, indexInfo, fks, temp);
	assert(status15 !== 'partial' && status16 !== 'partial', 'partial or ambiguous migration state');
	const settingsRows = await query(
		database,
		status16 === 'missing' ? 'Q_SETTINGS_PRE_0016' : 'Q_SETTINGS_POST_0016'
	);
	const key = randomBytes(32);
	try {
		keyed(settingsRows, key);
	} finally {
		key.fill(0);
	}
	const ended = new Date().toISOString();
	const audits = await query(database, 'Q_AUDIT_WINDOW', {
		start_utc: started,
		end_utc: ended
	});
	await secureEvidence('audit-baseline', { financial, audits, settingsRows }, async (path) => {
		const evidence = JSON.parse(await readFile(path, 'utf8'));
		assert(
			Array.isArray(evidence.financial) &&
				Array.isArray(evidence.audits) &&
				Array.isArray(evidence.settingsRows),
			'audit evidence readback failed'
		);
	});
	return {
		ok: true,
		database,
		migration0015: status15,
		migration0016: status16,
		noTempTable: Number(temp[0]?.table_count) === 0,
		coreQueries: core.length,
		coreShape: 'PASS',
		financialIdentityBaseline: 'PASS',
		settingsHmacPrepared: 'PASS',
		auditWindow: 'PASS'
	};
}

async function migrateShard(database) {
	requireDatabase(database);
	const start = new Date().toISOString();
	const [auth, settings, indexes, indexInfo, fks, temp, coreBefore, financialBefore] =
		await Promise.all([
			query(database, 'Q_AUTH_SCHEMA'),
			query(database, 'Q_SETTINGS_SCHEMA'),
			query(database, 'Q_SETTINGS_INDEX_LIST'),
			query(database, 'Q_SETTINGS_INDEX_INFO'),
			query(database, 'Q_SETTINGS_FKS'),
			query(database, 'Q_SETTINGS_TEMP_TABLE'),
			queryCoreCounts(database),
			query(database, 'Q_FINANCIAL_IDENTITIES')
		]);
	const status15 = classify0015(auth);
	const status16 = classify0016(settings, indexes, indexInfo, fks, temp);
	assert(status15 !== 'partial' && status16 !== 'partial', 'partial or ambiguous migration state');
	const disposition = {
		'0015': status15 === 'applied' ? 'skipped-present' : 'pending',
		'0016': status16 === 'applied' ? 'skipped-present' : 'pending'
	};
	const hmacKey = randomBytes(32);
	let expectedPost;
	try {
		if (status16 === 'missing') {
			const preRows = await query(database, 'Q_SETTINGS_PRE_0016');
			const projected = preRows.map((row) => ({
				...row,
				pin: row.pin === '1234' ? null : row.pin,
				pin_hash: null
			}));
			expectedPost = keyed(projected, hmacKey);
		}
		if (status15 === 'missing') {
			await executeMigration(database, '0015');
			disposition['0015'] = 'applied';
		}
		const authAfter = await query(database, 'Q_AUTH_SCHEMA');
		assert(classify0015(authAfter) === 'applied', '0015 schema verification failed');
		assert(
			Number((await query(database, 'Q_AUTH_UNLOCK_INVALID'))[0]?.invalid_count) === 0,
			'0015 data verification failed'
		);
		if (status16 === 'missing') {
			await executeMigration(database, '0016');
			disposition['0016'] = 'applied';
		}
		const [settingsAfter, indexesAfter, indexInfoAfter, fksAfter, tempAfter, postRows] =
			await Promise.all([
				query(database, 'Q_SETTINGS_SCHEMA'),
				query(database, 'Q_SETTINGS_INDEX_LIST'),
				query(database, 'Q_SETTINGS_INDEX_INFO'),
				query(database, 'Q_SETTINGS_FKS'),
				query(database, 'Q_SETTINGS_TEMP_TABLE'),
				query(database, 'Q_SETTINGS_POST_0016')
			]);
		assert(
			classify0016(settingsAfter, indexesAfter, indexInfoAfter, fksAfter, tempAfter) === 'applied',
			'0016 schema verification failed'
		);
		assert(
			postRows.every((row) => row.pin !== '1234'),
			'raw default PIN remains'
		);
		if (expectedPost)
			assert(
				sameBuffer(expectedPost, keyed(postRows, hmacKey)),
				'settings preservation HMAC mismatch'
			);
		let integrity = await query(database, 'Q_QUICK_CHECK').catch(() => []);
		if (!integrity.some((row) => String(Object.values(row)[0]).toLowerCase() === 'ok'))
			integrity = await query(database, 'Q_INTEGRITY_CHECK');
		assert(
			integrity.some((row) => String(Object.values(row)[0]).toLowerCase() === 'ok'),
			'integrity check failed'
		);
		const end = new Date().toISOString();
		const [coreAfter, financialAfter, audits] = await Promise.all([
			queryCoreCounts(database),
			query(database, 'Q_FINANCIAL_IDENTITIES'),
			query(database, 'Q_AUDIT_WINDOW', { start_utc: start, end_utc: end })
		]);
		const financial = await secureEvidence(
			'financial',
			{ before: financialBefore, after: financialAfter, audits },
			async (path) =>
				compareFinancial(
					JSON.parse(await readFile(path, 'utf8')).before,
					JSON.parse(await readFile(path, 'utf8')).after,
					JSON.parse(await readFile(path, 'utf8')).audits
				)
		);
		assert(
			financial.verdict === 'PASS',
			`financial preservation ${financial.verdict}: ${financial.reason || 'unknown'}`
		);
		return {
			ok: true,
			database,
			disposition,
			schema: 'PASS',
			settingsHmac: 'PASS',
			integrity: 'PASS',
			financial,
			coreRowsBefore: coreBefore.length,
			coreRowsAfter: coreAfter.length,
			start,
			end
		};
	} finally {
		hmacKey.fill(0);
	}
}

async function main() {
	await validateConfig();
	const [mode, ...args] = process.argv.slice(2);
	if (mode === 'self-test') {
		const recoveryManifest = await readValidatedRecoveryManifest();
		const recoveryEntry = recoveryManifest.entries[0];
		const recoveryArgs = [
			'--database',
			recoveryEntry.database_name,
			'--bookmark',
			recoveryEntry.bookmark,
			'--confirm-bookmark',
			recoveryEntry.bookmark
		];
		assert(
			redact('before-demo-secret-after', ['demo-secret']) === 'before-[REDACTED]-after',
			'redaction self-test failed'
		);
		assert(
			validRfc3339('2026-07-20T00:00:00.000Z') && !validRfc3339('bad'),
			'timestamp self-test failed'
		);
		assert(
			buildQuery('Q_IDEMPOTENCY_RESIDUE', {
				branch: 'samarinda',
				idempotency_key: 'uat-by1-self-test-0001'
			}).includes("'samarinda'"),
			'query self-test failed'
		);
		assert(
			!Object.hasOwn(QUERY, 'Q_CORE_COUNTS') &&
				CORE_COUNT_QUERY_IDS.length === 7 &&
				CORE_COUNT_QUERY_IDS.every((id) => Object.hasOwn(QUERY, id)),
			'core count split-query self-test failed'
		);
		expectDenied(
			() =>
				buildRestorePlan({
					args: recoveryArgs,
					manifest: recoveryManifest,
					approval: undefined,
					interactive: true,
					now: Date.parse(recoveryEntry.timestamp) + 1
				}),
			'restore default-denial self-test failed'
		);
		expectDenied(
			() =>
				buildRestorePlan({
					args: recoveryArgs.map((value, index) =>
						index === 3 || index === 5 ? `${recoveryEntry.bookmark}x` : value
					),
					manifest: recoveryManifest,
					approval: 'YES',
					interactive: true,
					now: Date.parse(recoveryEntry.timestamp) + 1
				}),
			'restore mismatch-denial self-test failed'
		);
		expectDenied(
			() =>
				buildRestorePlan({
					args: recoveryArgs,
					manifest: {
						...recoveryManifest,
						entries: recoveryManifest.entries.map((entry, index) =>
							index === 0
								? { ...entry, database_id: '00000000-0000-0000-0000-000000000000' }
								: entry
						)
					},
					approval: 'YES',
					interactive: true,
					now: Date.parse(recoveryEntry.timestamp) + 1
				}),
			'restore UUID-mismatch denial self-test failed'
		);
		expectDenied(
			() =>
				buildRestorePlan({
					args: recoveryArgs,
					manifest: recoveryManifest,
					approval: 'YES',
					interactive: false,
					now: Date.parse(recoveryEntry.timestamp) + 1
				}),
			'restore non-TTY-denial self-test failed'
		);
		expectDenied(
			() =>
				buildRestorePlan({
					args: recoveryArgs,
					manifest: recoveryManifest,
					approval: 'YES',
					interactive: true,
					now: Date.parse(recoveryEntry.conservative_restore_deadline) + 1
				}),
			'restore expired-deadline denial self-test failed'
		);
		const restorePlan = buildRestorePlan({
			args: recoveryArgs,
			manifest: recoveryManifest,
			approval: 'YES',
			interactive: true,
			now: Date.parse(recoveryEntry.timestamp) + 1
		});
		requireTypedRestoreConfirmation(restorePlan, restorePlan.confirmation);
		expectDenied(
			() => requireTypedRestoreConfirmation(restorePlan, 'RESTORE REJECTED'),
			'restore typed-confirmation denial self-test failed'
		);
		assert(
			JSON.stringify(restorePlan.argv) ===
				JSON.stringify([
					'd1',
					'time-travel',
					'restore',
					recoveryEntry.database_name,
					'--bookmark',
					recoveryEntry.bookmark,
					'--config',
					CONFIG,
					'--json'
				]),
			'restore argv dry-run self-test failed'
		);
		for (const tag of MIGRATIONS.keys()) await migrationFile(tag);
		console.log(
			JSON.stringify({
				ok: true,
				marker: MARKER,
				tests: [
					'config',
					'redaction',
					'allowlist',
					'split-core-counts',
					'migration-hashes',
					'recovery-manifest-acl-readback',
					'restore-default-denial',
					'restore-mismatch-denial',
					'restore-uuid-mismatch-denial',
					'restore-non-tty-denial',
					'restore-expired-deadline-denial',
					'restore-approved-argv-dry-run'
				]
			})
		);
		return;
	}
	if (mode === 'whoami') {
		console.log(await runWrangler(['whoami']));
		return;
	}
	if (mode === 'pages-secrets') {
		console.log(await runWrangler(['pages', 'secret', 'list', '--project-name', PROJECT]));
		return;
	}
	if (mode === 'pages-list') {
		console.log(await runWrangler(['pages', 'deployment', 'list', '--project-name', PROJECT]));
		return;
	}
	if (mode === 'pages-deploy') {
		assert(args.length === 1 && ['maintenance', 'app'].includes(args[0]), 'deploy mode rejected');
		const dir =
			args[0] === 'maintenance'
				? resolve(TASK, 'maintenance')
				: resolve(ROOT, '.svelte-kit/cloudflare');
		assert(
			relative(ROOT, dir) && !relative(ROOT, dir).startsWith('..'),
			'deploy directory rejected'
		);
		console.log(
			await runWrangler([
				'pages',
				'deploy',
				dir,
				'--project-name',
				PROJECT,
				'--branch',
				BRANCH,
				'--commit-dirty=true'
			])
		);
		return;
	}
	if (mode === 'd1-info') {
		assert(args.length === 1, 'd1-info args rejected');
		const db = requireDatabase(args[0]);
		const info = await runWrangler(['d1', 'info', db, '--config', CONFIG, '--json'], {
			json: true
		});
		assert(info.name === db && info.uuid === DATABASES.get(db), 'production D1 identity mismatch');
		console.log(JSON.stringify({ ...info, version: 'production' }));
		return;
	}
	if (mode === 'time-travel-info') {
		assert(args.length === 2 && validRfc3339(args[1]), 'time-travel args rejected');
		const db = requireDatabase(args[0]);
		console.log(
			JSON.stringify(
				await runWrangler(
					['d1', 'time-travel', 'info', db, '--timestamp', args[1], '--config', CONFIG, '--json'],
					{ json: true }
				)
			)
		);
		return;
	}
	if (mode === 'query') {
		assert(args.length >= 2, 'query args rejected');
		const db = requireDatabase(args[0]);
		const id = args[1];
		assert(!SENSITIVE_QUERY_IDS.has(id), 'sensitive query direct output rejected');
		const params =
			id === 'Q_IDEMPOTENCY_RESIDUE' ? { branch: args[2], idempotency_key: args[3] } : {};
		console.log(
			JSON.stringify({ ok: true, database: db, queryId: id, rows: await query(db, id, params) })
		);
		return;
	}
	if (mode === 'resolve-transaction') {
		assert(args.length === 2, 'resolve-transaction args rejected');
		const branch = args[0];
		const idempotencyKey = args[1];
		assert(['samarinda', 'balikpapan', 'berau'].includes(branch), 'branch rejected');
		assert(validUatKey(idempotencyKey), 'idempotency key rejected');
		const database = requireDatabase(`zatiaras-${branch}-group`);
		const rows = await query(database, 'Q_TRANSACTION_BY_IDEMPOTENCY', {
			branch,
			idempotency_key: idempotencyKey
		});
		assert(rows.length <= 1, 'idempotency lookup ambiguous');
		console.log(JSON.stringify({ ok: true, transaction_id: rows[0]?.transaction_id || null }));
		return;
	}
	if (mode === 'migrate-shard') {
		assert(args.length === 1, 'migrate args rejected');
		console.log(JSON.stringify(await migrateShard(requireDatabase(args[0]))));
		return;
	}
	if (mode === 'audit-shard') {
		assert(args.length === 1, 'audit-shard args rejected');
		console.log(JSON.stringify(await auditShardReadOnly(requireDatabase(args[0]))));
		return;
	}
	if (mode === 'migrate-exact') {
		assert(
			args.length === 6 &&
				args[0] === '--database' &&
				args[2] === '--migration' &&
				args[4] === '--confirm-hash',
			'migrate-exact args rejected'
		);
		const database = requireDatabase(args[1]);
		const migration = await migrationFile(args[3]);
		assert(args[5] === migration.hash, 'migration confirmation hash mismatch');
		await executeMigration(database, args[3]);
		console.log(JSON.stringify({ ok: true, database, migration: args[3], wholeFile: true }));
		return;
	}
	if (mode === 'time-travel-restore') {
		const recoveryManifest = await readValidatedRecoveryManifest();
		const plan = buildRestorePlan({
			args,
			manifest: recoveryManifest,
			approval: process.env.ALLOW_D1_TIME_TRAVEL_RESTORE,
			interactive: process.stdin.isTTY === true && process.stdout.isTTY === true
		});
		const remainingHours = Math.max(
			0,
			Math.floor((Date.parse(plan.deadline) - Date.now()) / 3600000)
		);
		process.stderr.write(
			[
				'DESTRUCTIVE D1 TIME TRAVEL RESTORE',
				`Database: ${plan.database}`,
				`Conservative recovery deadline: ${plan.deadline}`,
				`Remaining conservative window: ${remainingHours} hours`,
				'This operation replaces the current production database state.',
				`Type exactly: ${plan.confirmation}`
			].join('\n') + '\n'
		);
		const prompt = createInterface({ input: process.stdin, output: process.stdout });
		let typed;
		try {
			typed = await prompt.question('Confirmation: ');
		} finally {
			prompt.close();
		}
		requireTypedRestoreConfirmation(plan, typed);
		await runWrangler(plan.argv, { json: true, quiet: true });
		console.log(JSON.stringify({ ok: true, database: plan.database, restore: 'submitted' }));
		return;
	}
	fail('operation rejected');
}

main().catch((error) => {
	console.error(JSON.stringify({ ok: false, error: redact(error.message, []) }));
	process.exitCode = 1;
});
