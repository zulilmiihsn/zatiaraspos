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
  // Validasi input
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date string');
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  const [year, month, day] = parts.map(Number);
  // Validasi nilai tanggal
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error('Invalid date values');
  }
  if (year < 1900 || year > 2100) {
    throw new Error('Year out of valid range');
  }
  if (month < 1 || month > 12) {
    throw new Error('Month out of valid range');
  }
  if (day < 1 || day > 31) {
    throw new Error('Day out of valid range');
  }
  try {
    // Start: 00:00:00 WITA (UTC+8) = 16:00:00 UTC hari sebelumnya
    const startUtc = new Date(Date.UTC(year, month - 1, day - 1, 16, 0, 0));
    // End: 00:00:00 WITA hari berikutnya (UTC+8) = 16:00:00 UTC hari ini
    const endUtc = new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
    return {
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString()
    };
  } catch (error) {
    console.error('Error in getWitaDateRangeUtc:', error, 'dateStr:', dateStr);
    throw new Error(`Failed to convert date: ${dateStr}`);
  }
}

// Format UTC ke string waktu WITA untuk tampilan
export function formatWitaDateTime(dateStr: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', ...(opts || {}) });
}

// Konversi waktu WITA (YYYY-MM-DDTHH:mm:ss) ke UTC ISO string
export function witaToUtcISO(dateStr: string, timeStr: string = '00:00:00'): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second] = timeStr.split(':').map(Number);
  // WITA = UTC+8, jadi UTC = WITA-8
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second || 0));
  return utcDate.toISOString();
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
