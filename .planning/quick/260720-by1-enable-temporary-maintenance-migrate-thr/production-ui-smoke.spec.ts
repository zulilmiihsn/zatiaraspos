import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const branch = 'samarinda';
const evidenceDir =
	'.planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/playwright-production';
const journalPath = `${evidenceDir}/transaction-journal.json`;

function envValue(key: string): string {
	const direct = process.env[key]?.trim();
	if (direct) return direct;
	if (!existsSync('.env')) throw new Error(`${key} tidak tersedia`);
	const value = readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.find((line) => line.startsWith(`${key}=`))
		?.slice(key.length + 1)
		.trim()
		.replace(/^['"]|['"]$/g, '');
	if (!value) throw new Error(`${key} tidak tersedia`);
	return value;
}

const ownerUsername = envValue('UAT_USERNAME');
const password = envValue('UAT_PASSWORD');

function journal(data: Record<string, unknown>) {
	mkdirSync(evidenceDir, { recursive: true });
	writeFileSync(journalPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function login(page: Page, username: string) {
	await page.goto('/login', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
	await page.getByLabel('Pilih Cabang').selectOption(branch);
	await page.getByPlaceholder('Masukkan username').fill(username);
	await page.getByPlaceholder('Masukkan password').fill(password);
	const responsePromise = page.waitForResponse(
		(response) =>
			response.url().endsWith('/api/veriflogin') && response.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	const response = await responsePromise;
	expect(response.ok(), `${username}: login HTTP ${response.status()}`).toBe(true);
	await expect(page).toHaveURL(/\/$/);
	const session = await page.evaluate(() =>
		fetch('/api/session', { credentials: 'include' }).then((response) => response.json())
	);
	expect(session.authenticated, `${username}: session tidak aktif`).toBe(true);
	expect(session.user?.username).toBe(username);
}

async function assertHealthyPage(page: Page, path: string) {
	const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
	expect(response, `${path}: navigation response hilang`).not.toBeNull();
	expect(response!.status(), `${path}: HTTP ${response!.status()}`).toBeLessThan(400);
	await page.waitForTimeout(750);
	expect(page.url(), `${path}: terlempar ke login`).not.toContain('/login');
	const body = await page.locator('body').innerText();
	expect(body.trim().length, `${path}: body kosong`).toBeGreaterThan(20);
	expect(body, `${path}: server error terlihat`).not.toMatch(
		/Internal Server Error|Application Error/i
	);
	return { path, finalPath: new URL(page.url()).pathname, title: await page.title() };
}

async function cleanupTransaction(page: Page, transactionId: string) {
	return page.evaluate(async (id) => {
		const csrfResponse = await fetch('/api/csrf', { credentials: 'include' });
		const csrf = (await csrfResponse.json()) as { token?: string };
		if (!csrfResponse.ok || !csrf.token) {
			return { ok: false, status: csrfResponse.status, transactionRows: -1, ledgerRows: -1 };
		}
		const deletion = await fetch(`/api/transaksi-kasir?transaction_id=${encodeURIComponent(id)}`, {
			method: 'DELETE',
			credentials: 'include',
			headers: { 'X-CSRF-Token': csrf.token }
		});
		const [transactionsResponse, ledgerResponse] = await Promise.all([
			fetch(`/api/transaksi-kasir?transaction_id=${encodeURIComponent(id)}`, {
				credentials: 'include'
			}),
			fetch(`/api/buku-kas?transaction_id=${encodeURIComponent(id)}`, {
				credentials: 'include'
			})
		]);
		const transactions = await transactionsResponse.json().catch(() => []);
		const ledger = await ledgerResponse.json().catch(() => []);
		return {
			ok: deletion.ok && transactionsResponse.ok && ledgerResponse.ok,
			status: deletion.status,
			transactionRows: Array.isArray(transactions) ? transactions.length : -1,
			ledgerRows: Array.isArray(ledger) ? ledger.length : -1
		};
	}, transactionId);
}

async function newLoggedInPage(browser: Browser, username: string) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await login(page, username);
	return { context, page };
}

test('owner routes and feature surfaces render in production', async ({ page }) => {
	await login(page, ownerUsername);
	const routes = [
		'/',
		'/pos',
		'/catat',
		'/laporan',
		'/pengaturan',
		'/pengaturan/pemilik',
		'/pengaturan/pemilik/arsip',
		'/pengaturan/pemilik/gantikeamanan',
		'/pengaturan/pemilik/manajemenmenu',
		'/pengaturan/pemilik/riwayat',
		'/pengaturan/printer',
		'/pengaturan/riwayat'
	];
	const results = [];
	for (const route of routes) results.push(await assertHealthyPage(page, route));
	expect(results).toHaveLength(routes.length);
	const monitoring = await page.goto('/monitoring', { waitUntil: 'domcontentloaded' });
	expect(monitoring?.status()).toBe(403);
	await expect(page.locator('body')).toContainText('Monitoring hanya untuk administrator platform');
});

test('cashier core surfaces render and owner page is denied', async ({ page }) => {
	await login(page, 'kasir');
	for (const route of ['/', '/pos', '/pengaturan', '/pengaturan/printer', '/pengaturan/riwayat']) {
		await assertHealthyPage(page, route);
	}
	await page.goto('/pengaturan/pemilik', { waitUntil: 'domcontentloaded' });
	await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/unauthorized|\/pengaturan$/);
});

test('offline pending queue can be inspected, exported, and removed locally', async ({
	page,
	context
}) => {
	await login(page, ownerUsername);
	await context.setOffline(true);
	try {
		await page.evaluate(async () => {
			const now = new Date().toISOString();
			const entry = {
				queue_id: 'uat-pw-offline-queue',
				type: 'pos_transaction',
				status: 'failed',
				created_at: now,
				updated_at: now,
				attempt_count: 2,
				next_attempt_at: Number.MAX_SAFE_INTEGER,
				last_error: 'Sesi toko transaksi offline tidak valid',
				failure_kind: 'conflict',
				request: {
					idempotency_key: 'uat-pw-offline-checkout',
					metode_bayar: 'tunai',
					cash_received: 10_000,
					mode: 'offline_replay'
				},
				summary: {
					transaction_code: 'JUS-UAT-PW-OFFLINE',
					total_amount: 10_000,
					jumlah_item: 1,
					created_at: now
				}
			};
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('zatiaras-pending-transactions-v2');
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains('pending-transactions')) {
						request.result.createObjectStore('pending-transactions');
					}
				};
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const transaction = request.result.transaction('pending-transactions', 'readwrite');
					transaction.objectStore('pending-transactions').put([entry], 'pending_transactions');
					transaction.oncomplete = () => {
						request.result.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			});
			window.dispatchEvent(new CustomEvent('pending-changed'));
		});

		await expect(page.getByTestId('pending-transaction-banner')).toContainText(
			'1 transaksi belum tersinkron'
		);
		await expect(page.getByTestId('topbar-pending-count')).toHaveText('1');
		await page.getByRole('button', { name: 'Detail', exact: true }).click();
		await expect(page.getByTestId('pending-transaction-sheet')).toContainText('JUS-UAT-PW-OFFLINE');
		await expect(page.getByTestId('pending-transaction-sheet')).toContainText(
			'Sesi toko transaksi offline tidak valid'
		);

		const downloadPromise = page.waitForEvent('download');
		await page
			.getByTestId('pending-transaction-item')
			.getByRole('button', { name: 'Export', exact: true })
			.click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('JUS-UAT-PW-OFFLINE');

		await page
			.getByTestId('pending-transaction-item')
			.getByRole('button', { name: 'Hapus lokal', exact: true })
			.click();
		const confirmation = page.getByTestId('pending-removal-confirmation');
		await expect(confirmation).toBeVisible();
		await confirmation.getByRole('button', { name: 'Hapus lokal', exact: true }).click();
		await expect(page.getByTestId('pending-transaction-banner')).toBeHidden();
		await expect(page.getByTestId('topbar-pending-count')).toBeHidden();
	} finally {
		await context.setOffline(false);
	}
});

test('cashier checkout updates owner UI and cleanup leaves zero residue', async ({ browser }) => {
	let owner: { context: BrowserContext; page: Page } | undefined;
	let cashier: { context: BrowserContext; page: Page } | undefined;
	let transactionId = '';
	let cleaned = false;
	const marker = `UAT-PW-${Date.now()}`;
	journal({ status: 'starting', marker, transactionId: null, cleaned: false });

	try {
		owner = await newLoggedInPage(browser, ownerUsername);
		cashier = await newLoggedInPage(browser, 'kasir');
		await owner.page.goto('/', { waitUntil: 'domcontentloaded' });
		await expect(owner.page.getByText('Jumlah Transaksi', { exact: true })).toBeVisible();
		const dashboardBefore = await owner.page.locator('body').innerText();

		await cashier.page.goto('/pos', { waitUntil: 'domcontentloaded' });
		const product = cashier.page.getByRole('button', {
			name: 'Tambah Es Teh UAT ke keranjang'
		});
		await expect(product).toBeVisible({ timeout: 30_000 });
		await product.click();
		await cashier.page.getByRole('button', { name: 'Tambah ke Keranjang' }).click();
		await cashier.page.getByRole('button', { name: 'Bayar', exact: true }).click();
		await expect(cashier.page).toHaveURL(/\/pos\/bayar$/);
		await cashier.page.getByPlaceholder('Masukkan nama pelanggan...').fill(marker);
		await cashier.page.getByRole('button', { name: 'Tunai', exact: true }).click();
		await cashier.page.getByRole('button', { name: 'Konfirmasi & Bayar' }).click();
		await expect(cashier.page.getByText('Pembayaran Tunai', { exact: true })).toBeVisible();
		await cashier.page.getByRole('button', { name: 'Rp 10.000', exact: true }).click();
		journal({ status: 'intent-recorded', marker, transactionId: null, cleaned: false });
		const checkoutResponsePromise = cashier.page.waitForResponse(
			(response) =>
				response.url().endsWith('/api/pos/transaction') && response.request().method() === 'POST'
		);
		await cashier.page.getByRole('button', { name: 'Selesai', exact: true }).click();
		const checkoutResponse = await checkoutResponsePromise;
		expect(checkoutResponse.ok(), `checkout HTTP ${checkoutResponse.status()}`).toBe(true);
		const checkout = await checkoutResponse.json();
		transactionId = checkout.data?.transaction_id || '';
		expect(transactionId).not.toBe('');
		journal({ status: 'committed', marker, transactionId, cleaned: false });
		await expect(cashier.page.getByText('Transaksi Berhasil!', { exact: true })).toBeVisible();
		await expect(cashier.page.getByText('Rp 10.000', { exact: true }).first()).toBeVisible();

		await expect
			.poll(async () => owner!.page.locator('body').innerText(), { timeout: 30_000 })
			.not.toBe(dashboardBefore);

		const cleanup = await cleanupTransaction(owner.page, transactionId);
		expect(cleanup.ok, `cleanup HTTP ${cleanup.status}`).toBe(true);
		expect(cleanup.transactionRows).toBe(0);
		expect(cleanup.ledgerRows).toBe(0);
		cleaned = true;
		journal({ status: 'cleaned', marker, transactionId, cleaned: true, residue: cleanup });
	} finally {
		if (owner && transactionId && !cleaned) {
			const cleanup = await cleanupTransaction(owner.page, transactionId).catch(() => null);
			journal({
				status: cleanup?.ok ? 'cleaned-in-finally' : 'cleanup-failed',
				marker,
				transactionId,
				cleaned: Boolean(cleanup?.ok),
				residue: cleanup
			});
		}
		await cashier?.context.close();
		await owner?.context.close();
	}
});
