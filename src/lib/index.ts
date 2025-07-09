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
