import { error as kitError } from '@sveltejs/kit';
import { normalizeBranch, type BranchId } from '$lib/server/branchResolver';

type AppLocals = App.Locals;

const OWNER_TABLES = new Set([
	'produk',
	'kategori',
	'tambahan',
	'bahan',
	'resep_produk',
	'bahan_mutasi',
	'hpp_settings',
	'profil',
	'pengaturan'
]);
const CASHBOOK_TABLES = new Set(['buku_kas', 'transaksi_kasir']);
const CASHIER_TABLES = new Set(['sesi_toko']);

export function requireAuthSession(locals: AppLocals) {
	const session = locals.authSession;
	if (!session) {
		throw kitError(401, 'Login diperlukan');
	}
	return session;
}

export function requireSessionBranch(locals: AppLocals, requestedBranch?: unknown): BranchId {
	const session = requireAuthSession(locals);
	const sessionBranch = normalizeBranch(session.branch);
	const requested = requestedBranch ? normalizeBranch(requestedBranch) : sessionBranch;

	if (requested !== sessionBranch && session.role !== 'admin') {
		throw kitError(403, 'Branch tidak sesuai session');
	}

	return requested;
}

export function requireAnyRole(role: string, allowed: string[]) {
	if (role === 'admin' || allowed.includes(role)) return;
	throw kitError(403, 'Role tidak memiliki akses');
}

export function requireDataWriteAccess(
	table: string,
	action: string,
	role: string,
	payload: unknown
) {
	if (OWNER_TABLES.has(table)) {
		requireAnyRole(role, ['pemilik']);
		return;
	}

	if (CASHIER_TABLES.has(table)) {
		requireAnyRole(role, ['kasir', 'pemilik']);
		return;
	}

	if (CASHBOOK_TABLES.has(table)) {
		requireAnyRole(role, action === 'insert' ? ['kasir', 'pemilik'] : ['pemilik']);

		const rows = Array.isArray(payload) ? payload : [payload];
		const hasDirectPosInsert =
			action === 'insert' &&
			rows.some((row) => {
				const record = row as Record<string, unknown>;
				return record?.sumber === 'pos' || table === 'transaksi_kasir';
			});

		if (hasDirectPosInsert) {
			throw kitError(409, 'Transaksi POS harus lewat /api/pos/transaction');
		}
		return;
	}

	throw kitError(400, `Unknown table: ${table}`);
}
