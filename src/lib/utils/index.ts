// place files you want to import through the `$lib` alias in this folder.

// Konversi UTC ke waktu WITA (Asia/Makassar)
export function utcToWita(dateStr: string | Date): Date {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  // toLocaleString dengan timeZone Asia/Makassar
  const witaString = date.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  return new Date(witaString);
}

// Konversi waktu lokal WITA ke UTC (Date object)
export function witaToUtc(dateStr: string): Date {
  // dateStr: 'YYYY-MM-DDTHH:mm:ss' (anggap input sudah waktu lokal WITA)
  // Buat Date di Asia/Makassar, lalu konversi ke UTC
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  // Buat Date di Asia/Makassar
  const witaDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
  return witaDate;
}

// Dapatkan rentang UTC dari tanggal lokal WITA (YYYY-MM-DD)
export function getWitaDateRangeUtc(dateStr: string) {
  // dateStr: '2025-07-09'
  const startUtc = new Date(`${dateStr}T00:00:00+08:00`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59+08:00`).toISOString();
  return { startUtc, endUtc };
}

// Format UTC ke string waktu WITA untuk tampilan
export function formatWitaDateTime(dateStr: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', ...(opts || {}) });
}

// Tambahkan deklarasi global untuk window.scrollToSmooth
declare global {
  interface Window {
    scrollToSmooth: (targetY: number, duration?: number) => void;
  }
}
// Helper scrollToSmooth: scroll ke posisi Y dengan animasi smooth dan durasi custom (default 600ms, slowmo sedikit)
if (typeof window !== 'undefined') {
  window.scrollToSmooth = function(targetY: number, duration: number = 600) {
    const startY = window.scrollY;
    const diff = targetY - startY;
    let start: number | undefined;
    function step(timestamp: number) {
      if (start === undefined) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
      window.scrollTo(0, startY + diff * ease);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }
}
