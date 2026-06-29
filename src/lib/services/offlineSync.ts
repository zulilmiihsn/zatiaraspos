// ─── Offline sync ─────────────────────────────────────────────────────────────
//
// Subsistem sinkronisasi transaksi offline: replay antrian pending ke server
// (idempoten via idempotency_key), single-flight, backoff, klasifikasi gagal.
// Dipisah dari dataService agar tanggung jawab jelas. Listener window di akhir
// mendaftar otomatis saat modul ini dimuat (di-load via re-export di dataService).

import {
	getPendingTransactions,
	markPendingTransactionFailed,
	markPendingTransactionSyncing,
	removePendingTransaction,
	retryFailedPendingTransactions
} from '$lib/utils/offline';
import { classifySyncFailure, getRetryDelayMs, isPendingReady } from '$lib/utils/offlineQueue';
import { dbPost } from '$lib/services/dataApiClient';
import { parseApiError } from '$lib/utils/errorHandling';
import { fetchWithCsrfRetry } from '$lib/utils/csrf';

class PendingSyncError extends Error {
	constructor(
		message: string,
		readonly status?: number,
		readonly retryAfterMs?: number
	) {
		super(message);
		this.name = 'PendingSyncError';
	}
}

let pendingSync: Promise<void> | null = null;
let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function assertSyncResponse(response: Response, label: string): Promise<void> {
	if (response.ok) return;
	const message = await parseApiError(response, `${label}: HTTP ${response.status}`);
	const retryAfterSeconds = Number(response.headers.get('retry-after'));
	throw new PendingSyncError(
		message,
		response.status,
		Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
			? retryAfterSeconds * 1_000
			: undefined
	);
}

async function replayPendingTransaction(payload: Record<string, unknown>): Promise<void> {
	if (payload.type === 'pos_transaction' && payload.request) {
		const response = await fetchWithCsrfRetry('/api/pos/transaction', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload.request)
		});
		await assertSyncResponse(response, 'Sinkronisasi transaksi POS gagal');
		return;
	}

	if (
		payload.bukuKas &&
		typeof payload.bukuKas === 'object' &&
		(payload.bukuKas as Record<string, unknown>).sumber === 'pos' &&
		Array.isArray(payload.transaksiKasir)
	) {
		const bukuKas = payload.bukuKas as Record<string, any>;
		const response = await fetchWithCsrfRetry('/api/pos/transaction', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				idempotency_key: bukuKas.transaction_id || bukuKas.id,
				nama_pelanggan: bukuKas.nama_pelanggan || null,
				metode_bayar: bukuKas.metode_bayar,
				items: payload.transaksiKasir.map((item: Record<string, unknown>) => ({
					product_id: item.produk_id || null,
					nama_kustom: item.nama_kustom || null,
					custom_price: item.produk_id ? null : item.harga || item.nominal,
					jumlah: item.jumlah || 1,
					add_on_ids: []
				}))
			})
		});
		await assertSyncResponse(response, 'Sinkronisasi transaksi POS lama gagal');
		return;
	}

	if (payload.bukuKas && typeof payload.bukuKas === 'object') {
		const bukuKas = payload.bukuKas as Record<string, any>;
		await dbPost('buku_kas', 'insert', bukuKas);
		if (Array.isArray(payload.transaksiKasir) && payload.transaksiKasir.length) {
			await dbPost(
				'transaksi_kasir',
				'insert',
				payload.transaksiKasir.map((item: Record<string, unknown>) => ({
					...item,
					buku_kas_id: bukuKas.id
				}))
			);
		}
		return;
	}

	await dbPost('buku_kas', 'insert', payload);
}

function schedulePendingSync(delayMs: number): void {
	if (typeof window === 'undefined' || !navigator.onLine) return;
	if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
	pendingSyncTimer = setTimeout(
		() => {
			pendingSyncTimer = null;
			void syncPendingTransactions();
		},
		Math.max(250, delayMs)
	);
}

async function scheduleNextPendingSync(): Promise<void> {
	const retryable = (await getPendingTransactions()).filter(
		(item) => item.failure_kind !== 'auth' && item.failure_kind !== 'conflict'
	);
	if (!retryable.length) return;
	const nextAttemptAt = Math.min(...retryable.map((item) => item.next_attempt_at));
	schedulePendingSync(Math.max(250, nextAttemptAt - Date.now()));
}

async function runPendingTransactionSync(force = false): Promise<void> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return;
	const pendings = (await getPendingTransactions()).filter((item) => force || isPendingReady(item));
	if (!pendings.length) return;
	let synced = 0;
	let failed = 0;

	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('pending-sync-start'));
	}

	for (const trx of pendings) {
		const { queue_id: queueId, ...payload } = trx;
		await markPendingTransactionSyncing(queueId);
		try {
			await replayPendingTransaction(payload);
			await removePendingTransaction(queueId);
			synced++;
		} catch (error) {
			const status = error instanceof PendingSyncError ? error.status : undefined;
			const failureKind = classifySyncFailure(status);
			const retryAfterMs =
				error instanceof PendingSyncError && error.retryAfterMs
					? error.retryAfterMs
					: getRetryDelayMs(trx.attempt_count + 1);
			const isPermanent = failureKind === 'auth' || failureKind === 'conflict';
			await markPendingTransactionFailed(queueId, {
				error: error instanceof Error ? error.message : 'Sinkronisasi transaksi gagal',
				failureKind,
				nextAttemptAt: isPermanent ? Number.MAX_SAFE_INTEGER : Date.now() + retryAfterMs
			});
			failed++;
		}
	}

	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('pending-sync-result', { detail: { synced, failed } }));
		if (synced > 0) window.dispatchEvent(new CustomEvent('pending-synced'));
	}
	await scheduleNextPendingSync();
}

export function syncPendingTransactions(options: { force?: boolean } = {}): Promise<void> {
	if (pendingSync) return pendingSync;
	pendingSync = runPendingTransactionSync(Boolean(options.force)).finally(() => {
		pendingSync = null;
	});
	return pendingSync;
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => void syncPendingTransactions());
	window.addEventListener('pending-changed', () => schedulePendingSync(500));
	window.addEventListener('auth-session-refreshed', () => {
		void retryFailedPendingTransactions(['auth']).then(() => syncPendingTransactions());
	});
}
