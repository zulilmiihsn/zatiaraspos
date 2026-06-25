/**
 * Util cetak struk bersama (DRY) — dipakai oleh riwayat umum/kasir/pemilik.
 * Mengganti builder HTML struk yang sebelumnya diduplikasi verbatim di 3 file.
 *
 * Sumber kebenaran: lihat CONVENTIONS.md §2.
 */
import * as pako from 'pako';
import { Base64 } from 'js-base64';
import { LOGO_BASE64 } from '$lib/utils/logoBase64';
import { formatRupiah } from '$lib/utils/currency';
import { dataService } from '$lib/services/dataService';
import type { ReceiptSettings, HistoryItem } from '$lib/types/laporan';

/** Default pengaturan struk bila data toko belum tersedia. */
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
	nama_toko: 'Zatiaras Juice',
	alamat: 'Jl. Contoh Alamat No. 123, Kota',
	telepon: '0812-3456-7890',
	instagram: '@zatiarasjuice',
	// Newline asli '\n' (bukan literal '\\n') — dirender via white-space:pre-line.
	ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
};

/** Label metode bayar untuk tampilan struk. */
const METHOD_LABELS: Record<string, string> = {
	tunai: 'Tunai',
	qris: 'QRIS',
	transfer: 'Transfer',
	'e-wallet': 'E-Wallet',
	card: 'Kartu',
	'non-tunai': 'QRIS/Non-Tunai'
};

/**
 * Muat pengaturan struk dari DB, fallback ke localStorage.
 * Mengembalikan null bila keduanya tidak tersedia (caller pakai DEFAULT via buildReceiptHtml).
 */
export async function loadReceiptSettings(): Promise<ReceiptSettings | null> {
	try {
		const data = (await dataService.getOne('pengaturan')) as unknown as ReceiptSettings | null;
		if (data) return data;
	} catch {
		// abaikan, jatuh ke localStorage
	}
	const local = localStorage.getItem('pengaturan_struk');
	if (local) {
		try {
			return JSON.parse(local) as ReceiptSettings;
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Bangun HTML struk cetak-ulang untuk satu transaksi.
 * @param trx transaksi yang dicetak
 * @param pengaturan pengaturan struk (null → pakai DEFAULT_RECEIPT_SETTINGS)
 * @param items detail item (kosong → tampilkan satu baris ringkas dari trx)
 */
export function buildReceiptHtml(
	trx: HistoryItem,
	pengaturan: ReceiptSettings | null,
	items: Record<string, unknown>[]
): string {
	const p = pengaturan ?? DEFAULT_RECEIPT_SETTINGS;

	let html = `<html><body style='font-family:monospace;color:#000;font-size:14px;line-height:1.5;margin:0;padding:8px;'>`;
	html += `<div style='text-align:center;margin-bottom:12px;'>`;
	html += `<img src='${LOGO_BASE64}' style='width:80px;height:80px;margin:0 auto 8px;display:block;' />`;
	html += `<div style='font-weight:bold;font-size:20px;text-transform:uppercase;'>${p.nama_toko}</div>`;
	html += `<div style='font-size:13px;margin-top:4px;'>${p.alamat}</div>`;
	if (p.instagram || p.telepon) {
		html += `<div style='font-size:13px;margin-top:2px;'>${p.instagram ? p.instagram : ''}${p.instagram && p.telepon ? ' | ' : ''}${p.telepon ? p.telepon : ''}</div>`;
	}
	html += `</div>`;
	html += `<div style='border-bottom:1px dashed #333;margin-bottom:12px;'></div>`;

	html += `<div style='text-align:center;font-weight:bold;font-size:14px;margin-bottom:8px;'>*** CETAK ULANG ***</div>`;
	html += `<div style='text-align:left;font-size:13px;margin-bottom:12px;display:flex;justify-content:space-between;'>`;
	html += `<div>${trx.nama_pelanggan || ''}</div>`;
	html += `<div>${new Date(trx.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</div>`;
	html += `</div>`;

	html += `<table style='width:100%;font-size:14px;margin-bottom:12px;border-collapse:collapse;'><tbody>`;

	if (items.length > 0) {
		items.forEach((item: Record<string, unknown>) => {
			const produk = item.produk as Record<string, unknown> | undefined;
			const itemName = item.nama_kustom || (produk && produk.nama) || 'Produk Custom';
			html += `<tr><td style='text-align:left;padding-bottom:4px;font-weight:bold;'>${itemName} <span style='font-size:12px;font-weight:normal;'>x${item.jumlah}</span></td><td style='text-align:right;padding-bottom:4px;'>Rp${formatRupiah(Number(item.harga))}</td></tr>`;
		});
	} else {
		html += `<tr><td style='text-align:left;padding-bottom:4px;font-weight:bold;'>${trx.nama}</td><td style='text-align:right;padding-bottom:4px;'>Rp${formatRupiah(trx.nominal ?? 0)}</td></tr>`;
	}

	html += `</tbody></table>`;
	html += `<div style='border-bottom:1px dashed #333;margin-bottom:12px;'></div>`;

	html += `<table style='width:100%;font-size:14px;margin-bottom:24px;border-collapse:collapse;'><tbody>`;
	html += `<tr><td style='text-align:left;padding-bottom:4px;'>Total:</td><td style='text-align:right;font-weight:bold;font-size:16px;'>Rp${formatRupiah(trx.nominal ?? 0)}</td></tr>`;

	const methodKey = (trx.metode_bayar || '').toLowerCase();
	html += `<tr><td style='text-align:left;font-size:13px;padding-top:4px;'>Metode:</td><td style='text-align:right;font-size:13px;padding-top:4px;'>${METHOD_LABELS[methodKey] || methodKey}</td></tr>`;
	html += `</tbody></table>`;

	html += `<div style='text-align:center;font-size:13px;white-space:pre-line;'>${p.ucapan}</div>`;
	html += `</body></html>`;

	return html;
}

/** Kirim HTML struk ke printer via Android print-intent (gzip + base64). */
export function printViaIntent(html: string): void {
	const gzip = pako.gzip(JSON.stringify([html]));
	const base64 = Base64.fromUint8Array(gzip);
	const intentUrl = `intent://#Intent;scheme=print-intent;S.content=${base64};end`;
	window.location.href = intentUrl;
}
