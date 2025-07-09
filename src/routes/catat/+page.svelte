<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { slide } from 'svelte/transition';
import { cubicIn, cubicOut } from 'svelte/easing';
import { fade, fly } from 'svelte/transition';
import DatePickerSheet from '$lib/components/shared/DatePickerSheet.svelte';
import TimePickerSheet from '$lib/components/shared/TimePickerSheet.svelte';
import DropdownSheet from '$lib/components/shared/DropdownSheet.svelte';
import { validateNumber, validateText, validateDate, validateTime, sanitizeInput, validateIncomeExpense } from '$lib/validation.js';
import { SecurityMiddleware } from '$lib/security.js';
import { auth } from '$lib/auth.js';
import { goto } from '$app/navigation';
import { supabase } from '$lib/database/supabaseClient';
import { formatWitaDateTime } from '$lib/index';

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

let showDatePicker = false;
let showTimePicker = false;
let showDropdown = false;

// PIN Modal State
let showPinModal = false;
let pinInput = '';
let pinError = '';
let pin = '';
let userRole = '';
let errorTimeout: number;
let isClosing = false;

const jenisPemasukan = [
  { value: 'pendapatan_usaha', label: 'Pendapatan Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];
const jenisPengeluaran = [
  { value: 'beban_usaha', label: 'Beban Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];

let transaksiList = [];

let showSnackbar = false;
let snackbarMsg = '';

let observer;
let isBottomVisible = false;
let bottomRef;

// Helper untuk tanggal lokal user (YYYY-MM-DD)
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

onMount(async () => {
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Ambil session Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  userRole = '';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role || '';
  }
  await fetchPin();
  if (userRole === 'kasir') {
    const { data } = await supabase.from('security_settings').select('locked_pages').single();
    const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
    if (lockedPages.includes('catat')) {
      showPinModal = true;
    }
  }
  // Ganti inisialisasi date agar pakai waktu lokal user
  date = getLocalDateString();
  time = new Date().toTimeString().slice(0, 5);
  jenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
  await fetchTransaksi();

  observer = new IntersectionObserver(
    ([entry]) => {
      isBottomVisible = entry.isIntersecting;
    },
    { threshold: 0.1 }
  );
  if (bottomRef) observer.observe(bottomRef);
});

$: if (bottomRef && observer) {
  observer.observe(bottomRef);
}

onDestroy(() => {
  if (observer) observer.disconnect();
});

async function fetchPin() {
  const { data } = await supabase.from('security_settings').select('pin').single();
  pin = data?.pin || '1234';
}

async function fetchTransaksi() {
  const { data, error } = await supabase.from('cash_transactions').select('*').order('transaction_date', { ascending: false });
  if (!error) transaksiList = data;
}

// Helper untuk offset zona waktu lokal user (misal: +08:00)
function getLocalOffsetString() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => n.toString().padStart(2, '0');
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${sign}${hours}:${minutes}`;
}

async function saveTransaksi(form) {
  await supabase.from('cash_transactions').insert([{
    amount: form.amount,
    type: mode === 'pemasukan' ? 'in' : 'out',
    description: form.description,
    transaction_date: new Date(`${form.transaction_date}T${form.transaction_time || '00:00'}:00`).toISOString(),
    payment_method: form.payment_method,
    jenis: form.jenis
  }]);
  await fetchTransaksi();
}

// Optimized reactive statements for better performance
$: if (mode === 'pemasukan' && jenis !== 'pendapatan_usaha' && jenis !== 'lainnya') {
  jenis = 'pendapatan_usaha';
}
$: if (mode === 'pengeluaran' && jenis !== 'beban_usaha' && jenis !== 'lainnya') {
  jenis = 'beban_usaha';
}

function handleTouchStart(e) {
  if (!isTouchDevice) return;
  
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
  clickBlocked = false;
}

function handleTouchMove(e) {
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

function handleTouchEnd(e) {
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

function handleGlobalClick(e) {
  // Don't block clicks on interactive elements even if swipe was detected
  const target = e.target;
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

function formatRupiah(angka) {
  if (!angka) return '';
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function handleNominalInput(e) {
  // Hanya izinkan angka
  let val = e.target.value.replace(/\D/g, '');
  rawNominal = val;
  nominal = formatRupiah(val);
}

function setTemplateNominal(val) {
  let current = parseInt(rawNominal || '0', 10);
  let next = current + val;
  rawNominal = next.toString();
  nominal = formatRupiah(next);
}

async function handleSubmit(e) {
  e.preventDefault();
  error = '';
  
  // Check rate limiting
  if (!SecurityMiddleware.checkFormRateLimit('catat_form')) {
    error = 'Terlalu banyak submission. Silakan tunggu sebentar.';
    return;
  }
  
  // Sanitize inputs
  const sanitizedDate = sanitizeInput(date);
  const sanitizedTime = sanitizeInput(time);
  const sanitizedNominal = sanitizeInput(nominal);
  const sanitizedJenis = sanitizeInput(jenis);
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
  if (SecurityMiddleware.detectSuspiciousActivity('catat_form', allInputs)) {
    error = 'Input mencurigakan terdeteksi. Silakan coba lagi.';
    SecurityMiddleware.logSecurityEvent('suspicious_input_blocked', {
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
    type: sanitizedJenis,
    description: sanitizedNama
  };
  
  const completeValidation = validateIncomeExpense(dataToValidate);
  if (!completeValidation.isValid) {
    error = completeValidation.errors.join('\n');
    return;
  }
  
  // Simpan ke database: tanggal + jam input user (UTC ISO)
  const inputDateTime = new Date(`${sanitizedDate}T${sanitizedTime}`);
  await supabase.from('cash_transactions').insert([{
    amount: dataToValidate.amount,
    type: mode === 'pemasukan' ? 'in' : 'out',
    description: sanitizedNama,
    transaction_date: inputDateTime.toISOString(),
    payment_method: sanitizedPaymentMethod,
    jenis: sanitizedJenis
  }]);
  await fetchTransaksi();
  
  // Tampilkan snackbar sukses
  snackbarMsg = 'Transaksi berhasil dicatat!';
  showSnackbar = true;
  setTimeout(() => { showSnackbar = false; }, 1800);
  
  // Reset form
  rawNominal = '';
  namaJenis = '';
  nama = '';
}

function getJenisLabel(val) {
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

function handlePinSubmit() {
  if (pinInput === pin) {
    isClosing = true;
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    setTimeout(() => {
      showPinModal = false;
      pinError = '';
      pinInput = '';
      isClosing = false;
    }, 300);
  } else {
    pinError = 'PIN salah. Silakan coba lagi.';
    pinInput = '';
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    errorTimeout = setTimeout(() => {
      pinError = '';
    }, 2000);
  }
}

function handlePinInput(num) {
  if (pinInput.length < 4) {
    pinInput += num.toString();
    if (pinInput.length === 4) {
      setTimeout(() => handlePinSubmit(), 200);
    }
  }
}
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

{#if showPinModal}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out modal-pin"
    class:translate-y-full={isClosing}
    style="top: 58px; bottom: 58px; background: linear-gradient(to bottom right, #f472b6, #ec4899, #a855f7);"
  >
    {#if pinError}
      <div 
        class="fixed top-24 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
        style="transform: translateX(-50%);"
        in:fly={{ y: -32, duration: 300, easing: cubicOut }}
        out:fade={{ duration: 200 }}
      >
        {pinError}
      </div>
    {/if}
    <div class="w-full h-full flex flex-col items-center justify-center p-4">
      <div class="bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 max-w-sm w-full">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Akses Catat Transaksi</h2>
          <p class="text-pink-100 text-sm">Masukkan PIN untuk mencatat transaksi</p>
        </div>
        
        <!-- PIN Display -->
        <div class="flex justify-center gap-2 mb-6">
          {#each Array(4) as _, i}
            <div class="w-4 h-4 rounded-full {pinInput.length > i ? 'bg-white' : 'bg-white/30 border border-white/50'}"></div>
          {/each}
        </div>
        
        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-3 mb-4 justify-items-center">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
            <button
              type="button"
              class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
              onclick={() => handlePinInput(num)}
            >
              {num}
            </button>
          {/each}
          <div class="w-16 h-16"></div>
          <button
            type="button"
            class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
            onclick={() => handlePinInput(0)}
          >
            0
          </button>
          <div class="w-16 h-16"></div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showSnackbar}
  <div class="fixed left-1/2 bottom-28 -translate-x-1/2 bg-pink-500 text-white rounded-lg px-4 py-2 z-50 text-sm shadow-lg animate-fadeInOut">{snackbarMsg}</div>
{/if}

<div 
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
>
  <main class="flex-1 min-h-0 overflow-y-auto w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
  >
    <div class="px-2 pb-4 pt-4 md:pt-8 lg:pt-10">
      <div class="max-w-md mx-auto w-full pb-2 px-2">
        <div class="relative flex rounded-full overflow-hidden mb-5 shadow-sm border border-pink-100 bg-gray-50">
          <!-- Indicator Slide -->
          <div
            class="absolute top-0 left-0 h-full w-1/2 bg-white rounded-full shadow border border-pink-200 transition-transform duration-200 ease-out z-0"
            style="transform: translateX({mode === 'pengeluaran' ? '100%' : '0'});"
          ></div>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pemasukan' ? 'text-pink-500' : 'text-gray-400'}"
            type="button"
            aria-current={mode === 'pemasukan' ? 'page' : undefined}
            onclick={() => { 
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
            }}
          >
            Catat Pemasukan
          </button>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pengeluaran' ? 'text-pink-500' : 'text-gray-400'}"
            type="button"
            aria-current={mode === 'pengeluaran' ? 'page' : undefined}
            onclick={() => { 
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
            }}
          >
            Catat Pengeluaran
          </button>
        </div>
        <form class="flex flex-col gap-4 px-1 md:bg-white md:rounded-2xl md:shadow md:p-5 md:border md:border-pink-100 {jenis === 'lainnya' ? 'pb-18' : 'pb-14'}" onsubmit={handleSubmit} autocomplete="off" id="catat-form">
          <div class="flex flex-col sm:flex-row gap-4 sm:gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-pink-500 mb-1" for="tanggal-input">Tanggal</label>
              <input
                id="tanggal-input"
                type="date"
                class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1"
                bind:value={date}
                min="2020-01-01"
                max="2100-12-31"
                required
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-pink-500 mb-1" for="waktu-input">Waktu</label>
              <input
                id="waktu-input"
                type="time"
                class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1"
                bind:value={time}
                required
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1">Nominal</label>
            <input
              type="text"
              inputmode="numeric"
              class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1"
              value={nominal}
              oninput={handleNominalInput}
              required
              placeholder="Masukkan nominal"
              autocomplete="off"
            />
            <div class="flex flex-col items-center mt-2 mb-1">
              <div class="grid grid-cols-3 md:grid-cols-5 gap-2 w-full">
                <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200" onclick={() => setTemplateNominal(5000)}>Rp 5.000</button>
                <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200" onclick={() => setTemplateNominal(10000)}>Rp 10.000</button>
                <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200" onclick={() => setTemplateNominal(20000)}>Rp 20.000</button>
                <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200" onclick={() => setTemplateNominal(50000)}>Rp 50.000</button>
                <button type="button" class="w-full py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200" onclick={() => setTemplateNominal(100000)}>Rp 100.000</button>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1">Jenis {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <div class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 flex items-center cursor-pointer" onclick={() => showDropdown = true} tabindex="0" style="user-select:none;">
              <span class="truncate">{getJenisLabel(jenis)}</span>
            </div>
            <DropdownSheet open={showDropdown} value={jenis} options={mode === 'pemasukan' ? jenisPemasukan : jenisPengeluaran} on:close={() => showDropdown = false} on:select={e => { jenis = e.detail; showDropdown = false; }} />
          </div>
          {#if jenis === 'lainnya'}
            <div>
              <label class="block text-sm font-medium text-pink-500 mb-1">Nama Jenis</label>
              <input type="text" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1" bind:value={namaJenis} required placeholder="Masukkan nama jenis" />
            </div>
          {/if}
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-1">Nama {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <input type="text" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1" bind:value={nama} required />
          </div>
          
          <!-- Toggle Laci Kasir -->
          <div>
            <label class="block text-sm font-medium text-pink-500 mb-2">Laci Kasir</label>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center {paymentMethod === 'tunai' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div>
                  <div class="font-medium text-sm text-gray-800">Uang {mode === 'pemasukan' ? 'Masuk' : 'Keluar'} Laci</div>
                  <div class="text-xs text-gray-500">{paymentMethod === 'tunai' ? 'Ya, dari laci kasir' : 'Tidak, bukan dari laci kasir'}</div>
                </div>
              </div>
              <button
                type="button"
                class="relative w-12 h-6 rounded-full transition-colors duration-300 {paymentMethod === 'tunai' ? 'bg-green-500' : 'bg-gray-300'}"
                onclick={() => paymentMethod = paymentMethod === 'tunai' ? 'non-tunai' : 'tunai'}
              >
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 {paymentMethod === 'tunai' ? 'translate-x-6' : 'translate-x-0'}"></div>
              </button>
            </div>
          </div>
          {#if error}
            <div class="text-pink-600 text-sm text-center mt-1">{error}</div>
          {/if}
        </form>
        <div bind:this={bottomRef}></div>
      </div>
    </div>
  </main>
  <div class="fixed left-0 right-0 bottom-[56px] z-30 pt-2 pb-3 transition-all duration-500" class:px-2={!isBottomVisible} class:px-4={isBottomVisible}>
    <div
      class:w-full={!isBottomVisible}
      class:max-w-md={isBottomVisible}
      class:mx-auto={isBottomVisible}
    >
      <button type="submit" form="catat-form"
        class="transition-all duration-300 bg-pink-500 text-white font-bold text-lg border-none rounded-xl py-4 mt-1 shadow-lg shadow-pink-500/10 hover:bg-pink-600 active:bg-pink-700 w-full"
      >
        Simpan
      </button>
    </div>
  </div>
</div> 