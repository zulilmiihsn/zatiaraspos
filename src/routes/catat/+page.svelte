<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { slide } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { fade, fly } from 'svelte/transition';
import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
import { validateNumber, validateText, validateDate, validateTime, sanitizeInput, validateIncomeExpense } from '$lib/utils/validation';
import { securityUtils } from '$lib/utils/security';
import { auth } from '$lib/auth/auth';
import { goto } from '$app/navigation';
import { formatWitaDateTime, getWitaDateRangeUtc, witaToUtcISO } from '$lib/utils/index';
import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
import ModalSheet from '$lib/components/shared/modalSheet.svelte';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { addPendingTransaction } from '$lib/utils/offline';
import ToastNotification from '$lib/components/shared/toastNotification.svelte';

// Touch handling variables
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;
let isTouchDevice = false;
let clickBlocked = false;

const navs = [
  { label: 'Beranda', path: '/' },
  { label: 'Kasir', path: '/pos' },
  { label: 'Catat', path: '/catat' },
  { label: 'Laporan', path: '/laporan' },
];

let mode: 'pemasukan' | 'pengeluaran' = 'pemasukan';
let paymentMethod: 'tunai' | 'non-tunai' = 'tunai';
let date = '';
let time = '';
let rawNominal = '';
let nominal = '';
let jenis = '';
let namaJenis = '';
let nama = '';
let error = '';

let showDropdown = false;

// Removed PIN Modal State (showPinModal, pin, errorTimeout, isClosing)

// Toast notification state
let showToast = false;
let toastMessage = '';
let toastType: 'success' | 'error' | 'warning' | 'info' = 'success';

function showToastNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
  toastMessage = message;
  toastType = type;
  showToast = true;
}

const jenisPemasukan = [
  { value: 'pendapatan_usaha', label: 'Pendapatan Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];
const jenisPengeluaran = [
  { value: 'beban_usaha', label: 'Beban Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];

let showSnackbar = false;
let snackbarMsg = '';



// Helper untuk tanggal lokal user (YYYY-MM-DD)
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let currentUserRole = '';
userRole.subscribe(val => currentUserRole = val || '');

let sesiAktif: any = null;
async function cekSesiTokoAktif() {
  const { data } = await getSupabaseClient(storeGet(selectedBranch))
    .from('sesi_toko')
    .select('*')
    .eq('is_active', true)
    .order('opening_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  sesiAktif = data || null;
}

onMount(async () => {
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Hapus query role dari Supabase, gunakan store
  // const { data: { session } } = await supabase.auth.getSession();
  // const user = session?.user;
  // userRole = '';
  // if (user) {
  //   const { data: profile } = await supabase
  //     .from('profil')
  //     .select('role')
  //     .eq('id', user.id)
  //     .single();
  //   userRole = profile?.role || '';
  // }
  // Jika role belum ada di store, coba validasi dengan Supabase
  if (!currentUserRole) {
    const { data: { session } } = await getSupabaseClient(storeGet(selectedBranch)).auth.getSession();
    if (session?.user) {
      const { data: profile } = await getSupabaseClient(storeGet(selectedBranch))
        .from('profil')
        .select('role, username')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        setUserRole(profile.role, profile);
      }
    }
  }
  // Removed fetchPin() and locked_pages check
  // Ganti inisialisasi date agar pakai waktu lokal user
  date = getLocalDateString();
  time = new Date().toTimeString().slice(0, 5);
  jenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
  await cekSesiTokoAktif();
});



// Removed fetchPin()







let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning'; // 'warning' | 'success' | 'error'

function closeNotifModal() {
  showNotifModal = false;
}

async function saveTransaksi(form: any) {
  await cekSesiTokoAktif();
  const id_sesi_toko = sesiAktif?.id || null;
  if (!id_sesi_toko && currentUserRole === 'kasir') {
    notifModalMsg = 'Kasir tidak boleh melakukan transaksi saat toko tutup!';
    notifModalType = 'error';
    showNotifModal = true;
    return;
  }
  if (!id_sesi_toko && currentUserRole !== 'kasir') {
    notifModalMsg = 'PERINGATAN: Tidak ada sesi toko aktif! Transaksi akan dianggap di luar sesi dan tidak masuk ringkasan tutup toko.';
    notifModalType = 'warning';
    showNotifModal = true;
    // Tidak ada return di sini, agar insert tetap lanjut untuk pemilik
  }
  
  const utcTime = witaToUtcISO(form.transaction_date, form.transaction_time || '00:00');
  
  const trx = {
    tipe: mode === 'pemasukan' ? 'in' : 'out',
    sumber: 'catat',
    payment_method: form.payment_method,
    amount: form.amount,
    description: form.description,
    id_sesi_toko,
    // Perbaiki: Konversi waktu WITA ke UTC dengan benar
    waktu: utcTime,
    jenis: form.jenis
  };
  if (navigator.onLine) {
    const { error, data } = await getSupabaseClient(storeGet(selectedBranch)).from('buku_kas').insert([trx]);
    if (error) {
      notifModalMsg = 'Gagal menyimpan transaksi ke database: ' + error.message;
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
    // Setelah transaksi berhasil, invalidate cache dashboard/laporan dan fetch ulang data
    import('$lib/services/dataService').then(async ({ dataService }) => {
      await dataService.invalidateCacheOnChange('buku_kas');
      await dataService.invalidateCacheOnChange('transaksi_kasir');
    });
  } else {
    // Offline mode: simpan transaksi ke pending
    addPendingTransaction(trx);
    notifModalMsg = 'Transaksi disimpan offline dan akan otomatis sync saat online.';
    notifModalType = 'success';
    showNotifModal = true;
  }
}

// Optimized reactive statements for better performance
// Inisialisasi default jenis saat mode berubah
$: if (mode === 'pemasukan' && (!jenis || (jenis !== 'pendapatan_usaha' && jenis !== 'lainnya'))) {
  jenis = 'pendapatan_usaha';
}
$: if (mode === 'pengeluaran' && (!jenis || (jenis !== 'beban_usaha' && jenis !== 'lainnya'))) {
  jenis = 'beban_usaha';
}

function handleTouchStart(e: TouchEvent) {
  if (!isTouchDevice) return;
  
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
  clickBlocked = false;
}

function handleTouchMove(e: TouchEvent) {
  if (!isTouchDevice) return;
  
  touchEndX = e.touches[0].clientX;
  touchEndY = e.touches[0].clientY;
  
  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);
  const viewportWidth = window.innerWidth;
      const swipeThreshold = viewportWidth * 0.25; // 25% of viewport width (sama dengan pengaturan/pemilik)
  
  // Check if this is a horizontal swipe
  if (deltaX > swipeThreshold && deltaX > deltaY) {
    isSwiping = true;
    clickBlocked = true;
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (!isTouchDevice) return;
  
  if (isSwiping) {
    // Handle swipe navigation
    const deltaX = touchEndX - touchStartX;
    const viewportWidth = window.innerWidth;
    const swipeThreshold = viewportWidth * 0.25; // 25% of viewport width (sama dengan pengaturan/pemilik)
    
    if (Math.abs(deltaX) > swipeThreshold) {
      const currentIndex = 2; // Catat is index 2
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        goto(navs[currentIndex - 1].path);
      } else if (deltaX < 0 && currentIndex < navs.length - 1) {
        // Swipe left - go to next tab
        goto(navs[currentIndex + 1].path);
      }
    }
    
    // Block any subsequent click events
    setTimeout(() => {
      clickBlocked = false;
    }, 100);
  }
}

function handleGlobalClick(e: Event) {
  // Don't block clicks on interactive elements even if swipe was detected
  const target = e.target as HTMLElement;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  if (clickBlocked) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
}

function formatRupiah(angka: string | number): string {
  if (!angka) return '';
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function handleNominalInput(e: Event) {
  // Hanya izinkan angka
  const target = e.target as HTMLInputElement;
  let val = target.value.replace(/\D/g, '');
  rawNominal = val;
  nominal = formatRupiah(val);
}

function setTemplateNominal(val: number) {
  let current = parseInt(rawNominal || '0', 10);
  let next = current + val;
  rawNominal = next.toString();
  nominal = formatRupiah(next);
}

async function handleSubmit(e: Event) {
  e.preventDefault();
  error = '';
  
  // Remove SecurityMiddleware references - use securityUtils instead
  // Check rate limiting
  if (!securityUtils.checkFormRateLimit('catat_form')) {
    error = 'Terlalu banyak submission. Silakan tunggu sebentar.';
    return;
  }
  
  // Sanitize inputs
  const sanitizedDate = sanitizeInput(date);
  const sanitizedTime = sanitizeInput(time);
  const sanitizedNominal = sanitizeInput(nominal);
  let sanitizedJenis = sanitizeInput(jenis);
  if (!sanitizedJenis) {
    sanitizedJenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
  }
  const sanitizedNamaJenis = sanitizeInput(namaJenis);
  const sanitizedNama = sanitizeInput(nama);
  const sanitizedPaymentMethod = sanitizeInput(paymentMethod);
  
  // Validate all fields
  const timeValidation = validateTime(sanitizedTime);
  const nominalValidation = validateNumber(sanitizedNominal, { required: true, min: 0 });
  const jenisValidation = validateText(sanitizedJenis, { required: true });
  const namaValidation = validateText(sanitizedNama, { required: true, minLength: 2, maxLength: 100 });
  const paymentMethodValidation = validateText(sanitizedPaymentMethod, { required: true });
  
  // Check for suspicious activity
  const allInputs = `${sanitizedDate}${sanitizedTime}${sanitizedNominal}${sanitizedJenis}${sanitizedNamaJenis}${sanitizedNama}${sanitizedPaymentMethod}`;
  if (securityUtils.detectSuspiciousActivity('catat_form', allInputs)) {
    error = 'Input mencurigakan terdeteksi. Silakan coba lagi.';
    securityUtils.logSecurityEvent('suspicious_input_blocked', {
      form: 'catat',
      inputs: { date: sanitizedDate, time: sanitizedTime, nominal: sanitizedNominal }
    });
    return;
  }
  
  // Collect all validation errors
  const errors = [];
  if (!timeValidation.isValid) errors.push(`Waktu: ${timeValidation.errors.join(', ')}`);
  if (!nominalValidation.isValid) errors.push(`Nominal: ${nominalValidation.errors.join(', ')}`);
  if (!jenisValidation.isValid) errors.push(`Jenis: ${jenisValidation.errors.join(', ')}`);
  if (!namaValidation.isValid) errors.push(`Nama: ${namaValidation.errors.join(', ')}`);
  if (!paymentMethodValidation.isValid) errors.push(`Metode Pembayaran: ${paymentMethodValidation.errors.join(', ')}`);
  
  // Validate nama jenis if jenis is 'lainnya'
  if (sanitizedJenis === 'lainnya') {
    const namaJenisValidation = validateText(sanitizedNamaJenis, { required: true, minLength: 2, maxLength: 50 });
    if (!namaJenisValidation.isValid) {
      errors.push(`Nama Jenis: ${namaJenisValidation.errors.join(', ')}`);
    }
  }
  
  if (errors.length > 0) {
    error = errors.join('\n');
    return;
  }
  
  // Validate complete data object
  const dataToValidate = {
    amount: parseFloat(sanitizedNominal.replace(/\D/g, '')),
    description: sanitizedNama,
    transaction_date: sanitizedDate,
    transaction_time: sanitizedTime,
    payment_method: sanitizedPaymentMethod,
    jenis: sanitizedJenis
  };
  const completeValidation = validateIncomeExpense(dataToValidate);
  if (!completeValidation.isValid) {
    error = completeValidation.errors.join('\n');
    return;
  }
  
  // Simpan transaksi via saveTransaksi agar id_sesi_toko selalu terisi
  await saveTransaksi(dataToValidate);
  // Tampilkan snackbar sukses
  snackbarMsg = 'Transaksi berhasil dicatat!';
  showSnackbar = true;
  setTimeout(() => { showSnackbar = false; }, 1800);
  
  // Reset form
  rawNominal = '';
  namaJenis = '';
  nama = '';
}

function getJenisLabel(val: string): string {
  // Optimized to avoid array search on every call
  if (mode === 'pemasukan') {
    if (val === 'pendapatan_usaha') return 'Pendapatan Usaha';
    if (val === 'lainnya') return 'Lainnya';
  } else {
    if (val === 'beban_usaha') return 'Beban Usaha';
    if (val === 'lainnya') return 'Lainnya';
  }
  return '';
}

function handleSetPemasukan() {
  if (mode !== 'pemasukan') {
    mode = 'pemasukan';
    if (jenis !== 'pendapatan_usaha' && jenis !== 'lainnya') {
      jenis = 'pendapatan_usaha';
    }
    if (jenis === 'lainnya') {
      namaJenis = '';
    }
    nama = '';
  }
}
function handleSetPengeluaran() {
  if (mode !== 'pengeluaran') {
    mode = 'pengeluaran';
    if (jenis !== 'beban_usaha' && jenis !== 'lainnya') {
      jenis = 'beban_usaha';
    }
    if (jenis === 'lainnya') {
      namaJenis = '';
    }
    nama = '';
  }
}
function handleSetTemplateNominal(val: number) { return () => setTemplateNominal(val); }
</script>

<style>
main {
  flex: 1 1 auto;
}
@keyframes slideUp { 
  from { transform: translateY(100%); opacity: 0; } 
  to { transform: translateY(0); opacity: 1; } 
}

</style>

<!-- Toast Notification -->
<ToastNotification
  show={showToast}
  message={toastMessage}
  type={toastType}
  duration={2000}
  position="top"
/>

{#if showSnackbar}
  <div 
    class="fixed top-24 left-1/2 z-50 bg-pink-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 font-semibold text-base min-w-[220px]"
    style="transform: translateX(-50%);"
    in:fly={{ y: -32, duration: 300, easing: cubicOut }}
    out:fade={{ duration: 200 }}
  >
    <svg class="w-7 h-7 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" fill="#f9a8d4" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" />
    </svg>
    <span class="flex-1 text-center">{snackbarMsg}</span>
  </div>
{/if}

{#if showNotifModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-2xl shadow-2xl border-2 px-8 py-7 max-w-xs w-full flex flex-col items-center animate-slideUpModal"
      style="border-color: {notifModalType === 'success' ? '#facc15' : notifModalType === 'error' ? '#ef4444' : '#facc15'};">
      <div class="flex items-center justify-center w-16 h-16 rounded-full mb-3"
        style="background: {notifModalType === 'success' ? '#fef9c3' : notifModalType === 'error' ? '#fee2e2' : '#fef9c3'};">
        {#if notifModalType === 'success'}
          <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fef9c3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" stroke="#facc15" stroke-width="2" />
          </svg>
        {:else if notifModalType === 'error'}
          <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fee2e2" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
          </svg>
        {:else}
          <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fef9c3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" stroke="#facc15" stroke-width="2" />
          </svg>
        {/if}
      </div>
      <div class="text-center text-gray-700 font-medium text-base mb-4">{notifModalMsg}</div>
      <button class="mt-2 px-6 py-2 rounded-xl bg-pink-500 text-white font-bold shadow hover:bg-pink-600 transition-colors" onclick={closeNotifModal}>Tutup</button>
    </div>
  </div>
{/if}

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
  onkeydown={(e) => e.key === 'Escape' && handleGlobalClick(e)}
  onkeypress={(e) => e.key === 'Enter' && handleGlobalClick(e)}
  role="main"
  aria-label="Halaman catat pemasukan pengeluaran"
  tabindex="-1"
>
  <main class="flex-1 min-h-0 overflow-y-auto w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
  >
    <div class="px-2 pb-4 pt-4 md:pt-8 lg:pt-10">
      <div class="max-w-md mx-auto w-full pb-2 px-2 md:max-w-lg md:mx-auto md:pb-4 md:px-0 lg:max-w-2xl lg:mx-auto">
        <div class="relative flex rounded-full overflow-hidden mb-5 shadow-sm border border-pink-100 bg-gray-50 md:max-w-lg md:mx-auto">
          <!-- Indicator Slide -->
          <div
            class="absolute top-0 left-0 h-full w-1/2 bg-white rounded-full shadow border border-pink-200 transition-transform duration-200 ease-out z-0"
            style="transform: translateX({mode === 'pengeluaran' ? '100%' : '0'});"
          ></div>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pemasukan' ? 'text-pink-500' : 'text-gray-400'} md:text-lg"
            type="button"
            aria-current={mode === 'pemasukan' ? 'page' : undefined}
            onclick={handleSetPemasukan}
          >
            Catat Pemasukan
          </button>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pengeluaran' ? 'text-pink-500' : 'text-gray-400'} md:text-lg"
            type="button"
            aria-current={mode === 'pengeluaran' ? 'page' : undefined}
            onclick={handleSetPengeluaran}
          >
            Catat Pengeluaran
          </button>
        </div>
        <form class="flex flex-col gap-4 px-1 md:bg-white md:rounded-2xl md:shadow md:p-8 md:border md:border-pink-100 {jenis === 'lainnya' ? 'pb-18' : 'pb-14'} md:gap-6" onsubmit={handleSubmit} autocomplete="off" id="catat-form">
          <div class="flex flex-col sm:flex-row gap-4 sm:gap-4 md:gap-6">
            <div class="flex-1">
              <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="tanggal-input">Tanggal</label>
              <input
                id="tanggal-input"
                type="date"
                class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 md:text-lg md:py-3"
                bind:value={date}
                min="2020-01-01"
                max="2100-12-31"
                required
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="waktu-input">Waktu</label>
              <input
                id="waktu-input"
                type="time"
                class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 md:text-lg md:py-3"
                bind:value={time}
                required
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="nominal-input">Nominal</label>
            <input
              id="nominal-input"
              type="text"
              inputmode="numeric"
              class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 md:text-lg md:py-3"
              value={nominal}
              oninput={handleNominalInput}
              required
              placeholder="Masukkan nominal"
              autocomplete="off"
            />
            <div class="grid grid-cols-3 gap-2 w-full mt-2 mb-1 md:flex md:flex-wrap md:gap-3 md:justify-center md:grid-cols-none md:w-auto">
              <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 md:w-auto md:py-3 md:px-6 md:text-lg md:whitespace-nowrap" onclick={handleSetTemplateNominal(5000)}>Rp 5.000</button>
              <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 md:w-auto md:py-3 md:px-6 md:text-lg md:whitespace-nowrap" onclick={handleSetTemplateNominal(10000)}>Rp 10.000</button>
              <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 md:w-auto md:py-3 md:px-6 md:text-lg md:whitespace-nowrap" onclick={handleSetTemplateNominal(20000)}>Rp 20.000</button>
              <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 md:w-auto md:py-3 md:px-6 md:text-lg md:whitespace-nowrap" onclick={handleSetTemplateNominal(50000)}>Rp 50.000</button>
              <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 md:w-auto md:py-3 md:px-6 md:text-lg md:whitespace-nowrap" onclick={handleSetTemplateNominal(100000)}>Rp 100.000</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="jenis-dropdown">Jenis {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <button type="button" id="jenis-dropdown" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 flex items-center cursor-pointer md:text-lg md:py-3" onclick={() => showDropdown = true} onkeydown={(e) => e.key === 'Enter' && (showDropdown = true)} style="user-select:none;">
              <span class="truncate">{getJenisLabel(jenis)}</span>
            </button>
            <DropdownSheet open={showDropdown} value={jenis} options={mode === 'pemasukan' ? jenisPemasukan : jenisPengeluaran} on:close={() => showDropdown = false} on:select={e => { jenis = e.detail; showDropdown = false; }} />
          </div>
          {#if jenis === 'lainnya'}
            <div>
              <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="nama-jenis-input">Nama Jenis</label>
              <input id="nama-jenis-input" type="text" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 md:text-lg md:py-3" bind:value={namaJenis} required placeholder="Masukkan nama jenis" />
            </div>
          {/if}
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1 md:text-base" for="nama-input">Nama {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <input id="nama-input" type="text" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 md:text-lg md:py-3" bind:value={nama} required />
          </div>
          
          <!-- Toggle Laci Kasir -->
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-2 md:text-base" for="laci-kasir-toggle">Laci Kasir</label>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 md:p-4">
              <div class="flex items-center gap-3 md:gap-4">
                <div class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center {paymentMethod === 'tunai' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}">
                  <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div>
                  <div class="font-medium text-sm md:text-base text-gray-800">Uang {mode === 'pemasukan' ? 'Masuk' : 'Keluar'} Laci</div>
                  <div class="text-xs md:text-sm text-gray-500">{paymentMethod === 'tunai' ? 'Ya, dari laci kasir' : 'Tidak, bukan dari laci kasir'}</div>
                </div>
              </div>
              <button
                id="laci-kasir-toggle"
                type="button"
                class="relative w-12 h-6 md:w-14 md:h-7 rounded-full transition-colors duration-300 {paymentMethod === 'tunai' ? 'bg-green-500' : 'bg-gray-300'}"
                onclick={() => paymentMethod = paymentMethod === 'tunai' ? 'non-tunai' : 'tunai'}
                onkeydown={(e) => e.key === 'Enter' && (paymentMethod = paymentMethod === 'tunai' ? 'non-tunai' : 'tunai')}
                aria-label="Toggle laci kasir"
              >
                <div class="absolute top-0.5 left-0.5 w-5 h-5 md:w-6 md:h-6 bg-white rounded-full shadow-sm transition-transform duration-300 {paymentMethod === 'tunai' ? 'translate-x-6 md:translate-x-7' : 'translate-x-0'}"></div>
              </button>
            </div>
          </div>
          {#if error}
            <div class="text-pink-600 text-sm md:text-base text-center mt-1">{error}</div>
          {/if}
        </form>
      </div>
    </div>
  </main>
  <!-- Button Simpan -->
  <div class="fixed left-0 right-0 bottom-[56px] z-30 pt-2 pb-3 px-4">
    <div class="max-w-md mx-auto md:max-w-lg md:mx-auto">
      <button type="submit" form="catat-form"
        class="transition-all duration-300 bg-pink-500 text-white font-bold text-lg border-none rounded-xl py-4 mt-1 shadow-lg shadow-pink-500/10 hover:bg-pink-600 active:bg-pink-700 w-full"
      >
        Simpan
      </button>
    </div>
  </div>
</div>