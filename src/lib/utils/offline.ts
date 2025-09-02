import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const PENDING_KEY = 'pending_transactions';

export async function addPendingTransaction(trx: unknown) {
	const existing = (await idbGet(PENDING_KEY)) || [];
	existing.push(trx);
	await idbSet(PENDING_KEY, existing);
}

export async function getPendingTransactions(): Promise<any[]> {
	return (await idbGet(PENDING_KEY)) || [];
}

export async function clearPendingTransactions() {
	await idbDel(PENDING_KEY);
}
