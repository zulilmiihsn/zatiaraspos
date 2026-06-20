import assert from 'node:assert/strict';
import {
	classifySyncFailure,
	getPendingDedupeKey,
	getRetryDelayMs,
	isPendingReady,
	normalizePendingTransaction
} from '../lib/utils/offlineQueue';
import {
	isOfflinePosPath,
	persistOfflineSessionSnapshot,
	readOfflineSessionSnapshot
} from '../lib/auth/offlineSession';

class MemoryStorage {
	private values = new Map<string, string>();

	getItem(key: string) {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string) {
		this.values.set(key, value);
	}

	removeItem(key: string) {
		this.values.delete(key);
	}
}

const now = Date.parse('2026-06-19T00:00:00.000Z');

const normalized = normalizePendingTransaction(
	{
		type: 'pos_transaction',
		request: { idempotency_key: 'checkout-12345678' }
	},
	{ now, queueId: 'queue-1' }
);
assert.equal(normalized.queue_id, 'queue-1');
assert.equal(normalized.status, 'pending');
assert.equal(normalized.attempt_count, 0);
assert.equal(normalized.next_attempt_at, 0);
assert.equal(getPendingDedupeKey(normalized), 'pos:checkout-12345678');

const legacy = normalizePendingTransaction(
	{ queue_id: 'legacy-1', bukuKas: { id: 'kas-1' } },
	{ now }
);
assert.equal(legacy.queue_id, 'legacy-1');
assert.equal(legacy.status, 'pending');
assert.equal(legacy.created_at, '2026-06-19T00:00:00.000Z');

assert.equal(getRetryDelayMs(1), 1_000);
assert.equal(getRetryDelayMs(2), 2_000);
assert.equal(getRetryDelayMs(20), 300_000);
assert.equal(classifySyncFailure(401), 'auth');
assert.equal(classifySyncFailure(409), 'conflict');
assert.equal(classifySyncFailure(429), 'rate_limit');
assert.equal(classifySyncFailure(503), 'server');
assert.equal(classifySyncFailure(), 'network');

assert.equal(isPendingReady(normalized, now), true);
assert.equal(
	isPendingReady(
		{ ...normalized, status: 'failed', failure_kind: 'auth', next_attempt_at: 0 },
		now
	),
	false
);
assert.equal(
	isPendingReady(
		{
			...normalized,
			status: 'syncing',
			updated_at: new Date(now - 6 * 60_000).toISOString()
		},
		now
	),
	true
);

const storage = new MemoryStorage();
const expiresAt = Date.now() + 60_000;
persistOfflineSessionSnapshot({ id: 'u1', role: 'kasir' }, expiresAt, storage);
assert.equal(readOfflineSessionSnapshot(storage)?.user.role, 'kasir');
assert.equal(readOfflineSessionSnapshot(storage, expiresAt + 1), null);
assert.equal(isOfflinePosPath('/pos'), true);
assert.equal(isOfflinePosPath('/pos/bayar'), true);
assert.equal(isOfflinePosPath('/laporan'), false);

console.log('offline-pos-tests: 20 assertions passed');
