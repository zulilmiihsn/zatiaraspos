// place files you want to import through the `$lib` alias in this folder.

// Konversi UTC ke waktu WITA (Asia/Makassar)
// Catatan: Objek Date di JavaScript secara internal selalu UTC. Fungsi ini mengonversi
// string/objek Date ke representasi string WITA, lalu membuat objek Date baru dari string WITA tersebut.
// Ini berguna jika Anda ingin objek Date yang 'terlihat' seperti waktu WITA saat di-debug,
// namun perlu diingat nilai UTC internalnya akan berbeda dari waktu lokal WITA yang sebenarnya.
export function utcToWita(dateStr: string | Date): Date {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const witaString = date.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  return new Date(witaString);
}

// Konversi waktu lokal WITA ke UTC (Date object)
// Catatan: Fungsi ini mengasumsikan offset WITA selalu +8 dan tidak memperhitungkan
// Daylight Saving Time (DST) atau perubahan zona waktu historis. Untuk aplikasi
// yang beroperasi di zona waktu tetap tanpa DST, ini mungkin berfungsi.
export function witaToUtc(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const witaDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second || 0));
  return witaDate;
}

// Dapatkan rentang UTC dari tanggal lokal WITA (YYYY-MM-DD)
// Catatan: Fungsi ini mengasumsikan offset WITA selalu +8 dan tidak memperhitungkan
// Daylight Saving Time (DST) atau perubahan zona waktu historis.
export function getWitaDateRangeUtc(dateStr: string) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date string: must be a non-empty string.');
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error('Invalid date values: year, month, or day is not a number.');
  }
  // Basic range validation for year, month, day
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('Date values out of valid range.');
  }
  
  // Start: 00:00:00 WITA (UTC+8) = 16:00:00 UTC hari sebelumnya
  const startUtc = new Date(Date.UTC(year, month - 1, day - 1, 16, 0, 0));
  // End: 00:00:00 WITA hari berikutnya (UTC+8) = 16:00:00 UTC hari ini
  const endUtc = new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString()
  };
}

// Format UTC ke string waktu WITA untuk tampilan
export function formatWitaDateTime(dateStr: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', ...(opts || {}) });
}

// Konversi waktu WITA (YYYY-MM-DDTHH:mm:ss) ke UTC ISO string
// Catatan: Fungsi ini mengasumsikan offset WITA selalu +8 dan tidak memperhitungkan
// Daylight Saving Time (DST) atau perubahan zona waktu historis.
export function witaToUtcISO(dateStr: string, timeStr: string = '00:00:00'): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second] = timeStr.split(':').map(Number);
  // WITA = UTC+8, jadi UTC = WITA-8
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second || 0));
  return utcDate.toISOString();
}

// Toast management utility to reduce code duplication
export function createToastManager() {
  // Create reactive stores for toast state
  const toastState = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    timeout: undefined as number | undefined // Menggunakan undefined untuk konsistensi dengan setTimeout
  };

  function showToastNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', duration: number = 3000) {
    toastState.message = message;
    toastState.type = type;
    toastState.show = true;
    
    // Clear existing timeout
    if (toastState.timeout) {
      clearTimeout(toastState.timeout);
    }
    
    // Auto hide after duration
    toastState.timeout = window.setTimeout(() => {
      toastState.show = false;
      toastState.timeout = undefined;
    }, duration);
  }

  function hideToast() {
    toastState.show = false;
    if (toastState.timeout) {
      clearTimeout(toastState.timeout);
      toastState.timeout = undefined;
    }
  }

  // Return an object with reactive properties
  return {
    get showToast() { return toastState.show; },
    get toastMessage() { return toastState.message; },
    get toastType() { return toastState.type; },
    showToastNotification,
    hideToast
  };
}

// Centralized error handling utility
export function handleError(error: unknown, context: string, showUserFeedback: boolean = false) {
  // Log error for debugging (only in development)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.error(`❌ Error in ${context}:`, error);
  }
  
  // Return user-friendly error message
  if (showUserFeedback) {
    return {
      message: 'Terjadi kesalahan. Silakan coba lagi.',
      details: error instanceof Error ? error.message : 'Unknown error',
      context
    };
  }
  
  return null;
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

// Helper functions for date labels
export function getTodayWITA(): Date {
  const now = new Date();
  const witaString = now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const witaDate = new Date(witaString);
  witaDate.setHours(0, 0, 0, 0);
  return witaDate;
}

export function getLast7DaysLabelsWITA(): string[] {
  const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const todayWITA = getTodayWITA();
  let labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayWITA);
    d.setDate(todayWITA.getDate() - i);
    labels.push(hari[d.getDay()]);
  }
  return labels;
}