/**
 * Zatiaras POS - Cross-platform print helper
 *
 * Android : Menggunakan intent:// standar RawBT (metode lama, sudah terbukti stabil).
 * Windows : Menggunakan custom protocol zatiarasprint:// yang terdaftar di Registry,
 *           diproses oleh pos_print_handler.php → print_com.ps1 → COM4.
 */

export function executePrint(intentUrl: string) {
	const isAndroid = /android/i.test(navigator.userAgent);

	if (isAndroid) {
		// Metode lama — langsung navigasi ke intent URL.
		// RawBT di Android akan menangkap scheme "print-intent" dan mencetak.
		window.location.href = intentUrl;
		return;
	}

	// --- Windows / Desktop ---
	// Ambil payload base64 dari string intent.
	// Format intentUrl: intent://#Intent;scheme=print-intent;S.content=BASE64;end
	const match = intentUrl.match(/S\.content=([^;]+)/);
	const base64 = match ? match[1] : intentUrl;

	// Kirim ke native protocol handler yang terdaftar di Windows Registry.
	// Registry key: HKCU\Software\Classes\zatiarasprint
	// Command     : php-win.exe pos_print_handler.php "%1"
	window.location.href = `zatiarasprint://${base64}`;
}
