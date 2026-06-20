export type PendingStatus = 'pending' | 'syncing' | 'failed';
export type PendingFailureKind = 'auth' | 'conflict' | 'network' | 'rate_limit' | 'server' | null;

export interface PendingTransaction extends Record<string, unknown> {
	queue_id: string;
	status: PendingStatus;
	created_at: string;
	updated_at: string;
	attempt_count: number;
	next_attempt_at: number;
	last_error: string | null;
	failure_kind: PendingFailureKind;
}

const VALID_STATUSES = new Set<PendingStatus>(['pending', 'syncing', 'failed']);
const VALID_FAILURE_KINDS = new Set<Exclude<PendingFailureKind, null>>([
	'auth',
	'conflict',
	'network',
	'rate_limit',
	'server'
]);

function finiteNonNegative(value: unknown, fallback = 0): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizePendingTransaction(
	value: unknown,
	options: { now?: number; queueId?: string } = {}
): PendingTransaction {
	const now = options.now ?? Date.now();
	const isoNow = new Date(now).toISOString();
	const item =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: { payload: value };
	const status = VALID_STATUSES.has(item.status as PendingStatus)
		? (item.status as PendingStatus)
		: 'pending';
	const failureKind = VALID_FAILURE_KINDS.has(
		item.failure_kind as Exclude<PendingFailureKind, null>
	)
		? (item.failure_kind as Exclude<PendingFailureKind, null>)
		: null;

	return {
		...item,
		queue_id:
			typeof item.queue_id === 'string' && item.queue_id.length > 0
				? item.queue_id
				: options.queueId || crypto.randomUUID(),
		status,
		created_at: typeof item.created_at === 'string' ? item.created_at : isoNow,
		updated_at: typeof item.updated_at === 'string' ? item.updated_at : isoNow,
		attempt_count: Math.floor(finiteNonNegative(item.attempt_count)),
		next_attempt_at: finiteNonNegative(item.next_attempt_at),
		last_error: typeof item.last_error === 'string' ? item.last_error.slice(0, 240) : null,
		failure_kind: failureKind
	};
}

export function isNormalizedPendingTransaction(value: unknown): value is PendingTransaction {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.queue_id === 'string' &&
		VALID_STATUSES.has(item.status as PendingStatus) &&
		typeof item.created_at === 'string' &&
		typeof item.updated_at === 'string' &&
		Number.isFinite(Number(item.attempt_count)) &&
		Number.isFinite(Number(item.next_attempt_at)) &&
		(item.last_error === null || typeof item.last_error === 'string')
	);
}

export function getPendingDedupeKey(item: PendingTransaction): string | null {
	if (item.type !== 'pos_transaction' || !item.request || typeof item.request !== 'object') {
		return null;
	}
	const idempotencyKey = (item.request as Record<string, unknown>).idempotency_key;
	return typeof idempotencyKey === 'string' && idempotencyKey.length > 0
		? `pos:${idempotencyKey}`
		: null;
}

export function getRetryDelayMs(attemptCount: number): number {
	const safeAttempt = Math.max(1, Math.floor(attemptCount));
	return Math.min(5 * 60_000, 1_000 * 2 ** Math.min(safeAttempt - 1, 9));
}

export function isPendingReady(item: PendingTransaction, now = Date.now()): boolean {
	if (item.status === 'syncing') return now - Date.parse(item.updated_at) >= 5 * 60_000;
	if (item.failure_kind === 'auth' || item.failure_kind === 'conflict') return false;
	return item.next_attempt_at <= now;
}

export function classifySyncFailure(status?: number): Exclude<PendingFailureKind, null> {
	if (status === 401 || status === 403) return 'auth';
	if (status === 400 || status === 404 || status === 409 || status === 422) return 'conflict';
	if (status === 429) return 'rate_limit';
	if (status && status >= 500) return 'server';
	return 'network';
}
