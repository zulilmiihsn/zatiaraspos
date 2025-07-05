<script lang="ts">
import { onMount } from 'svelte';
import DatePickerSheet from '$lib/components/shared/DatePickerSheet.svelte';
import TimePickerSheet from '$lib/components/shared/TimePickerSheet.svelte';
import DropdownSheet from '$lib/components/shared/DropdownSheet.svelte';
import { validateNumber, validateText, validateDate, validateTime, sanitizeInput, validateIncomeExpense } from '$lib/validation.js';
import { SecurityMiddleware } from '$lib/security.js';
import { goto } from '$app/navigation';

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

const jenisPemasukan = [
  { value: 'pendapatan_usaha', label: 'Pendapatan Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];
const jenisPengeluaran = [
  { value: 'beban_usaha', label: 'Beban Usaha' },
  { value: 'lainnya', label: 'Lainnya' },
];

onMount(() => {
  // Detect touch device
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  const now = new Date();
  date = now.toISOString().slice(0, 10);
  time = now.toTimeString().slice(0, 5);
  jenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
});

$: if (mode === 'pemasukan' && !jenisPemasukan.find(j => j.value === jenis)) jenis = 'pendapatan_usaha';
$: if (mode === 'pengeluaran' && !jenisPengeluaran.find(j => j.value === jenis)) jenis = 'beban_usaha';

function handleTouchStart(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
  clickBlocked = false;
}

function handleTouchMove(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  touchEndX = e.touches[0].clientX;
  touchEndY = e.touches[0].clientY;
  
  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);
  const viewportWidth = window.innerWidth;
  const swipeThreshold = viewportWidth * 0.4; // 40% of viewport width
  
  // Check if this is a horizontal swipe
  if (deltaX > swipeThreshold && deltaX > deltaY) {
    isSwiping = true;
    clickBlocked = true;
  }
}

function handleTouchEnd(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  if (isSwiping) {
    // Handle swipe navigation
    const deltaX = touchEndX - touchStartX;
    const viewportWidth = window.innerWidth;
    const swipeThreshold = viewportWidth * 0.4;
    
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

function handleSubmit(e) {
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
  
  // Validate all fields
  const dateValidation = validateDate(sanitizedDate);
  const timeValidation = validateTime(sanitizedTime);
  const nominalValidation = validateNumber(sanitizedNominal, { required: true, min: 0 });
  const jenisValidation = validateText(sanitizedJenis, { required: true });
  const namaValidation = validateText(sanitizedNama, { required: true, minLength: 2, maxLength: 100 });
  
  // Check for suspicious activity
  const allInputs = `${sanitizedDate}${sanitizedTime}${sanitizedNominal}${sanitizedJenis}${sanitizedNamaJenis}${sanitizedNama}`;
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
  if (!dateValidation.isValid) errors.push(`Tanggal: ${dateValidation.errors.join(', ')}`);
  if (!timeValidation.isValid) errors.push(`Waktu: ${timeValidation.errors.join(', ')}`);
  if (!nominalValidation.isValid) errors.push(`Nominal: ${nominalValidation.errors.join(', ')}`);
  if (!jenisValidation.isValid) errors.push(`Jenis: ${jenisValidation.errors.join(', ')}`);
  if (!namaValidation.isValid) errors.push(`Nama: ${namaValidation.errors.join(', ')}`);
  
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
  
  // Log successful submission
  SecurityMiddleware.logSecurityEvent('income_expense_recorded', {
    mode,
    amount: dataToValidate.amount,
    type: dataToValidate.type
  });
  
  // Simpan data (dummy)
  alert(`Disimpan: ${mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}\nTanggal: ${sanitizedDate} ${sanitizedTime}\nNominal: Rp${dataToValidate.amount.toLocaleString('id-ID')}\nJenis: ${sanitizedJenis === 'lainnya' ? sanitizedNamaJenis : (mode === 'pemasukan' ? 'Pendapatan Usaha' : 'Beban Usaha')}\nNama: ${sanitizedNama}`);
  
  // Reset form
  rawNominal = '';
  namaJenis = '';
  nama = '';
}

function getJenisLabel(val) {
  const arr = mode === 'pemasukan' ? jenisPemasukan : jenisPengeluaran;
  return arr.find(j => j.value === val)?.label || '';
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

<div 
  class="min-h-max flex flex-col"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
>
  <main class="min-h-max">
    <div class="px-2 py-4">
      <div class="max-w-md mx-auto w-full pt-2 pb-2 px-2">
        <div class="relative flex rounded-full overflow-hidden mb-5 shadow-sm border border-pink-100 bg-gray-50">
          <!-- Indicator Slide -->
          <div
            class="absolute top-0 left-0 h-full w-1/2 bg-white rounded-full shadow border border-pink-200 transition-transform duration-300 z-0"
            style="transform: translateX({mode === 'pengeluaran' ? '100%' : '0'});"
          ></div>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pemasukan' ? 'text-pink-500' : 'text-gray-400'}"
            type="button"
            aria-current={mode === 'pemasukan' ? 'page' : undefined}
            onclick={() => { mode = 'pemasukan'; jenis = 'pendapatan_usaha'; namaJenis = ''; nama = ''; }}
          >
            Catat Pemasukan
          </button>
          <button
            class="flex-1 h-14 md:h-16 min-h-0 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200 z-10 {mode === 'pengeluaran' ? 'text-pink-500' : 'text-gray-400'}"
            type="button"
            aria-current={mode === 'pengeluaran' ? 'page' : undefined}
            onclick={() => { mode = 'pengeluaran'; jenis = 'beban_usaha'; namaJenis = ''; nama = ''; }}
          >
            Catat Pengeluaran
          </button>
        </div>
        <form class="flex flex-col gap-4 px-1 md:bg-white md:rounded-2xl md:shadow md:p-5 md:border md:border-pink-100 {jenis === 'lainnya' ? 'pb-16' : 'pb-12'}" onsubmit={handleSubmit} autocomplete="off" id="catat-form">
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
            <label class="block text-sm font-medium text-pink-500 mb-1">Nominal (Rp)</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
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
          {#if error}
            <div class="text-pink-600 text-sm text-center mt-1">{error}</div>
          {/if}
        </form>
      </div>
    </div>
  </main>
  <div class="fixed left-0 right-0 bottom-[56px] z-30 px-2 pt-2 pb-3">
    <button type="submit" form="catat-form" class="w-full bg-pink-500 text-white font-bold text-lg border-none rounded-xl py-4 mt-1 shadow-lg shadow-pink-500/10 transition-colors duration-200 hover:bg-pink-600 active:bg-pink-700">Simpan</button>
  </div>
</div> 