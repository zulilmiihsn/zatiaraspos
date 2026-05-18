/**
 * /api/data/+server.ts
 * Unified edge data API for Cloudflare D1 via Drizzle ORM.
 * All DB access goes through this endpoint — never expose DB bindings to the browser.
 *
 * Pattern:  GET  /api/data?table=produk&branch=samarinda[&filters...]
 *           POST /api/data  { table, action, payload, branch }
 */

import { json, error as kitError } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, lte, inArray, desc, asc, sql } from 'drizzle-orm';
import {
	produk,
	kategori,
	tambahan,
	bukuKas,
	transaksiKasir,
	profil,
	pengaturan,
	sesiToko
} from '$lib/database/schema';
import type { RequestHandler } from './$types';

// ---------- helpers ----------

function getDb(platform: any) {
	if (!platform?.env?.DB) {
		throw kitError(503, 'Database not available');
	}
	return drizzle(platform.env.DB);
}

function requireBranch(url: URL) {
	const branch = url.searchParams.get('branch');
	if (!branch) throw kitError(400, 'branch is required');
	return branch;
}

// ---------- GET handler ----------

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform);
	const table = url.searchParams.get('table');
	const branch = url.searchParams.get('branch') || '';
	const startTime = url.searchParams.get('start');
	const endTime = url.searchParams.get('end');
	const limit = Number(url.searchParams.get('limit') || 1000);
	const sumber = url.searchParams.get('sumber');
	const tipe = url.searchParams.get('tipe');

	switch (table) {
		case 'produk': {
			const rows = await db
				.select()
				.from(produk)
				.where(eq(produk.branch_id, branch))
				.orderBy(desc(produk.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'kategori': {
			const rows = await db
				.select()
				.from(kategori)
				.where(eq(kategori.branch_id, branch))
				.orderBy(desc(kategori.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'tambahan': {
			const rows = await db
				.select()
				.from(tambahan)
				.where(eq(tambahan.branch_id, branch))
				.orderBy(desc(tambahan.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'buku_kas': {
			const filters: any[] = [eq(bukuKas.branch_id, branch)];
			if (startTime) filters.push(gte(bukuKas.waktu, startTime));
			if (endTime) filters.push(lte(bukuKas.waktu, endTime));
			if (sumber) filters.push(eq(bukuKas.sumber, sumber));
			if (tipe) filters.push(eq(bukuKas.tipe, tipe));

			const rows = await db
				.select()
				.from(bukuKas)
				.where(and(...filters))
				.orderBy(asc(bukuKas.waktu))
				.limit(limit);
			return json(rows);
		}

		case 'transaksi_kasir': {
			const filters: any[] = [eq(transaksiKasir.branch_id, branch)];
			if (startTime) filters.push(gte(transaksiKasir.created_at, startTime));
			if (endTime) filters.push(lte(transaksiKasir.created_at, endTime));

			const bukuKasIdsParam = url.searchParams.get('buku_kas_ids');
			if (bukuKasIdsParam) {
				const ids = bukuKasIdsParam.split(',').filter(Boolean);
				if (ids.length) filters.push(inArray(transaksiKasir.buku_kas_id, ids));
			}

			const rows = await db
				.select()
				.from(transaksiKasir)
				.where(and(...filters))
				.orderBy(asc(transaksiKasir.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'dashboard_stats': {
			if (!branch) throw kitError(400, 'branch required');
			if (!startTime || !endTime) throw kitError(400, 'start and end required');

			const [kasir, kas] = await Promise.all([
				db
					.select({ qty: transaksiKasir.qty, transaction_id: bukuKas.transaction_id })
					.from(transaksiKasir)
					.innerJoin(bukuKas, eq(transaksiKasir.buku_kas_id, bukuKas.id))
					.where(
						and(
							eq(transaksiKasir.branch_id, branch),
							gte(transaksiKasir.created_at, startTime),
							lte(transaksiKasir.created_at, endTime)
						)
					),
				db
					.select({ amount: bukuKas.amount, tipe: bukuKas.tipe, transaction_id: bukuKas.transaction_id })
					.from(bukuKas)
					.where(
						and(
							eq(bukuKas.branch_id, branch),
							eq(bukuKas.sumber, 'pos'),
							gte(bukuKas.waktu, startTime),
							lte(bukuKas.waktu, endTime)
						)
					)
			]);

			return json({ kasir, kas });
		}

		case 'pos_kas_7hari': {
			if (!branch || !startTime || !endTime) throw kitError(400, 'branch, start, end required');

			const rows = await db
				.select({ transaction_id: bukuKas.transaction_id, waktu: bukuKas.waktu })
				.from(bukuKas)
				.where(
					and(
						eq(bukuKas.branch_id, branch),
						eq(bukuKas.sumber, 'pos'),
						gte(bukuKas.waktu, startTime),
						lte(bukuKas.waktu, endTime)
					)
				);

			return json(rows);
		}

		case 'sesi_toko': {
			const rows = await db
				.select()
				.from(sesiToko)
				.where(eq(sesiToko.branch_id, branch))
				.orderBy(desc(sesiToko.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'pengaturan': {
			const rows = await db
				.select()
				.from(pengaturan)
				.where(eq(pengaturan.branch_id, branch))
				.limit(1);
			return json(rows);
		}

		default:
			throw kitError(400, `Unknown table: ${table}`);
	}
};

// ---------- POST handler ----------

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform);
	const body = await request.json() as {
		table: string;
		action: 'insert' | 'update' | 'delete';
		payload: Record<string, unknown> | Record<string, unknown>[];
		branch: string;
		where?: { id?: string; transaction_id?: string };
	};

	const { table, action, payload, branch, where: whereClause } = body;

	if (!table || !action || !branch) {
		throw kitError(400, 'table, action, branch are required');
	}

	switch (table) {
		// ---- produk ----
		case 'produk': {
			if (action === 'insert') {
				const row = Array.isArray(payload) ? payload : [payload];
				await db.insert(produk).values(row.map((r) => ({ ...r, branch_id: branch } as any)));
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				await db.update(produk).set({ ...(payload as any) }).where(eq(produk.id, whereClause.id));
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db.delete(produk).where(eq(produk.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- kategori ----
		case 'kategori': {
			if (action === 'insert') {
				await db.insert(kategori).values({ ...(payload as any), branch_id: branch });
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				await db.update(kategori).set({ ...(payload as any) }).where(eq(kategori.id, whereClause.id));
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db.delete(kategori).where(eq(kategori.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- tambahan ----
		case 'tambahan': {
			if (action === 'insert') {
				await db.insert(tambahan).values({ ...(payload as any), branch_id: branch });
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				await db.update(tambahan).set({ ...(payload as any) }).where(eq(tambahan.id, whereClause.id));
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db.delete(tambahan).where(eq(tambahan.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- buku_kas ----
		case 'buku_kas': {
			if (action === 'insert') {
				const rows = Array.isArray(payload) ? payload : [payload];
				await db.insert(bukuKas).values(rows.map((r) => ({ ...r, branch_id: branch } as any)));
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				await db.update(bukuKas).set({ ...(payload as any) }).where(eq(bukuKas.id, whereClause.id));
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db.delete(bukuKas).where(eq(bukuKas.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- transaksi_kasir ----
		case 'transaksi_kasir': {
			if (action === 'insert') {
				const rows = Array.isArray(payload) ? payload : [payload];
				await db.insert(transaksiKasir).values(rows.map((r) => ({ ...r, branch_id: branch } as any)));
				return json({ ok: true });
			}
			break;
		}

		// ---- profil ----
		case 'profil': {
			if (action === 'update' && whereClause?.id) {
				await db.update(profil).set({ ...(payload as any) }).where(eq(profil.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- sesi_toko ----
		case 'sesi_toko': {
			if (action === 'insert') {
				const row = Array.isArray(payload) ? payload : [payload];
				await db.insert(sesiToko).values(row.map((r) => ({ ...r, branch_id: branch } as any)));
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				await db.update(sesiToko).set({ ...(payload as any) }).where(eq(sesiToko.id, whereClause.id));
				return json({ ok: true });
			}
			break;
		}

		// ---- pengaturan ----
		case 'pengaturan': {
			if (action === 'insert') {
				const row = Array.isArray(payload) ? payload : [payload];
				await db.insert(pengaturan).values(row.map((r) => ({ ...r, branch_id: branch } as any)));
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.id) {
				const idNum = Number(whereClause.id);
				await db.update(pengaturan).set({ ...(payload as any) }).where(eq(pengaturan.id, idNum));
				return json({ ok: true });
			}
			break;
		}

		default:
			throw kitError(400, `Unknown table: ${table}`);
	}

	throw kitError(400, `Invalid action '${action}' for table '${table}'`);
};
