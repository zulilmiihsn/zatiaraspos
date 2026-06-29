import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import type { HistoryItem, ReceiptSettings } from '$lib/types/laporan';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { buildReceiptHtml, buildSaleReceiptHtml } = await vite.ssrLoadModule(
	'/src/lib/utils/receiptPrint.ts'
);

const settings: ReceiptSettings = {
	nama_toko: 'Toko UAT',
	alamat: 'Jalan UAT 1',
	telepon: '0812000000',
	instagram: '@toko.uat',
	ucapan: 'Terima kasih\nDatang kembali'
};

const history: HistoryItem = {
	id: 'history-1',
	transaction_id: 'transaction-1',
	waktu: '2026-06-29T08:30:00.000Z',
	nama: 'Transaksi UAT',
	nominal: 25_000,
	tipe: 'in',
	sumber: 'pos',
	metode_bayar: 'tunai',
	nama_pelanggan: 'Pelanggan UAT'
};

const reprint = buildReceiptHtml(history, settings, [
	{
		nama_kustom: 'Jus UAT',
		jumlah: 2,
		harga: 12_500
	}
]);

const sale = buildSaleReceiptHtml({
	settings,
	items: [
		{
			product: { nama: 'Jus UAT', harga: 10_000 },
			jumlah: 2,
			addOns: [{ nama: 'Ekstra UAT', harga: 2_500 }],
			gula: 'normal',
			es: 'sedikit',
			catatan: 'UAT'
		}
	],
	customerName: 'Pelanggan UAT',
	total: 25_000,
	paymentMethod: 'tunai',
	cashReceived: 30_000,
	change: 5_000,
	queuedOffline: true,
	printedAt: new Date('2026-06-29T08:30:00.000Z')
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

assert.equal(hash(reprint), '0a699f228e3ae5abe1ea203337c36ea7a59c1b284177be1e62bbdd9474a877bb');
assert.equal(hash(sale), 'b323fb88407aa2585adeb177e2baece10b6d3005df9116bf79e94e9c46e6bc56');
console.log('Receipt HTML hashes match pre-refactor output.');
void vite.close();
process.exit(0);
