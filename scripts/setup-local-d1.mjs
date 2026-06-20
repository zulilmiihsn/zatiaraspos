/**
 * Siapkan D1 lokal (miniflare) untuk load test / dev: apply schema + seed UAT.
 *
 * Menerapkan, berurutan, ke binding DB_SAMARINDA_GROUP --local:
 *   1. Semua migration Drizzle drizzle/*.sql (skema kanonik domain + infra)
 *   2. seed-uat-samarinda.sql  (profil kasir/pemilik + produk uat-produk-es-teh)
 *
 * Pakai:
 *   node scripts/setup-local-d1.mjs
 *
 * Idempoten: migration pakai "IF NOT EXISTS", seed pakai "WHERE NOT EXISTS",
 * aman dijalankan ulang. Migration yang sudah ada di-skip otomatis.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const BINDING = 'DB_SAMARINDA_GROUP';
const CONFIG = 'wrangler.pages.jsonc';

const migrations = readdirSync('drizzle')
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => ({ file: `drizzle/${f}`, tolerant: true, label: `migration ${f}` }));

const steps = [
	...migrations,
	{ file: 'scripts/seed-uat-samarinda.sql', tolerant: false, label: 'seed UAT samarinda' }
];

function run(file) {
	const args = [
		'wrangler',
		'd1',
		'execute',
		BINDING,
		'--local',
		`--config=${CONFIG}`,
		`--file=${file}`,
		'--yes'
	];
	const result = spawnSync('npx', args, {
		stdio: 'pipe',
		encoding: 'utf8',
		shell: process.platform === 'win32'
	});
	return result;
}

let failed = false;
for (const step of steps) {
	process.stdout.write(`-> ${step.label} (${step.file}) ... `);
	const res = run(step.file);
	const ok = res.status === 0;
	if (ok) {
		console.log('OK');
		continue;
	}
	const out = `${res.stdout || ''}\n${res.stderr || ''}`;
	// Skema/ALTER yang idempoten sering gagal dengan "already exists" — toleransi.
	if (step.tolerant && /already exists|duplicate column/i.test(out)) {
		console.log('SKIP (sudah ada)');
		continue;
	}
	console.log('GAGAL');
	console.error(out.trim().slice(0, 1500));
	failed = true;
	if (!step.tolerant) break;
}

if (failed) {
	console.error('\nSetup D1 lokal gagal. Periksa pesan di atas.');
	process.exit(1);
}
console.log('\nD1 lokal siap: profil kasir/pemilik + produk uat-produk-es-teh (branch samarinda).');
console.log('Lanjut: jalankan `pnpm dev`, lalu load test ke http://localhost:5173');
