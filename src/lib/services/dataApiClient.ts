import { selectedBranch } from '$lib/stores/selectedBranch.svelte';

export type DataRecord = Record<string, unknown>;

export type DataPage<T> = {
	data: T[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type DataMutationResult<T extends DataRecord = DataRecord> = {
	ok: boolean;
	data?: T[];
	duplicate?: boolean;
};

const PAGE_SIZE = 200;
const MAX_ACCUMULATED_ROWS = 50_000;

function currentBranch(): string {
	return selectedBranch.value || 'default';
}

async function parseError(response: Response, operation: string): Promise<Error> {
	const payload = (await response.json().catch(() => null)) as
		| { message?: unknown; error?: unknown }
		| null;
	const detail = String(payload?.message || payload?.error || `HTTP ${response.status}`);
	return new Error(`${operation} gagal: ${detail}`);
}

export async function dbGet<T extends DataRecord = DataRecord>(
	table: string,
	params: Record<string, string> = {}
): Promise<T[]> {
	const qs = new URLSearchParams({ table, branch: currentBranch(), ...params }).toString();
	const response = await fetch(`/api/data?${qs}`);
	if (!response.ok) return [];
	return (await response.json()) as T[];
}

export async function dbGetStrict<T extends DataRecord = DataRecord>(
	table: string,
	params: Record<string, string> = {}
): Promise<T[]> {
	const qs = new URLSearchParams({ table, branch: currentBranch(), ...params }).toString();
	const response = await fetch(`/api/data?${qs}`);
	if (!response.ok) throw await parseError(response, `GET ${table}`);
	return (await response.json()) as T[];
}

export async function dbGetPage<T extends DataRecord = DataRecord>(
	table: 'buku_kas' | 'transaksi_kasir',
	params: Record<string, string> = {},
	cursor?: string | null
): Promise<DataPage<T>> {
	const query = new URLSearchParams({
		table,
		branch: currentBranch(),
		...params,
		pagination: 'cursor',
		limit: params.limit || String(PAGE_SIZE)
	});
	if (cursor) query.set('cursor', cursor);

	const response = await fetch(`/api/data?${query.toString()}`);
	if (!response.ok) throw await parseError(response, `GET ${table} page`);
	return (await response.json()) as DataPage<T>;
}

export async function dbGetAll<T extends DataRecord = DataRecord>(
	table: 'buku_kas' | 'transaksi_kasir',
	params: Record<string, string> = {}
): Promise<T[]> {
	const rows: T[] = [];
	let cursor: string | null = null;
	do {
		const page: DataPage<T> = await dbGetPage<T>(table, params, cursor);
		rows.push(...page.data);
		if (rows.length > MAX_ACCUMULATED_ROWS) {
			throw new Error(`GET ${table} melebihi batas ${MAX_ACCUMULATED_ROWS} baris`);
		}
		cursor = page.nextCursor;
	} while (cursor);
	return rows;
}

export async function dbPost<T extends DataRecord = DataRecord>(
	table: string,
	action: 'insert' | 'update' | 'delete',
	payload: DataRecord | DataRecord[],
	where?: Record<string, string>
): Promise<DataMutationResult<T>> {
	const response = await fetch('/api/data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ table, action, payload, branch: currentBranch(), where })
	});
	if (!response.ok) throw await parseError(response, `POST ${table}/${action}`);
	return (await response.json()) as DataMutationResult<T>;
}
