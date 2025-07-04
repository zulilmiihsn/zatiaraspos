<script lang="ts">
import { onMount } from 'svelte';
import DatePickerSheet from '$lib/components/shared/DatePickerSheet.svelte';
import TimePickerSheet from '$lib/components/shared/TimePickerSheet.svelte';
import DropdownSheet from '$lib/components/shared/DropdownSheet.svelte';

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
  const now = new Date();
  date = now.toISOString().slice(0, 10);
  time = now.toTimeString().slice(0, 5);
  jenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
});

$: if (mode === 'pemasukan' && !jenisPemasukan.find(j => j.value === jenis)) jenis = 'pendapatan_usaha';
$: if (mode === 'pengeluaran' && !jenisPengeluaran.find(j => j.value === jenis)) jenis = 'beban_usaha';

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

function handleSubmit() {
  error = '';
  if (!date || !time || !nominal || !jenis || (jenis === 'lainnya' && !namaJenis) || !nama) {
    error = 'Semua field wajib diisi.';
    return;
  }
  if (isNaN(Number(nominal)) || Number(nominal) <= 0) {
    error = 'Nominal harus angka lebih dari 0.';
    return;
  }
  // Simpan data (dummy)
  alert(`Disimpan: ${mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}\nTanggal: ${date} ${time}\nNominal: Rp${Number(nominal).toLocaleString('id-ID')}\nJenis: ${jenis === 'lainnya' ? namaJenis : (mode === 'pemasukan' ? 'Pendapatan Usaha' : 'Beban Usaha')}\nNama: ${nama}`);
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
.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fff;
}
main {
  flex: 1 1 auto;
}
.catat-tab {
  flex: 1;
  padding: 0.95rem 0;
  font-weight: 600;
  font-size: 1.08rem;
  border: none;
  background: #f9f9fb;
  color: #ff5fa2;
  border-bottom: 2.5px solid transparent;
  border-radius: 999px 999px 0 0;
  transition: all 0.18s;
  box-shadow: 0 2px 8px rgba(255,95,162,0.07);
}
.catat-tab.active {
  background: #fff;
  color: #e94e8f;
  border-bottom: 2.5px solid #ff5fa2;
  box-shadow: 0 4px 16px rgba(255,95,162,0.10);
}
.catat-form-label {
  font-size: 0.98rem;
  font-weight: 500;
  color: #ff5fa2;
  margin-bottom: 0.18rem;
  display: block;
}
.catat-input, .catat-select {
  width: 100%;
  border: 1.5px solid #f3c6db;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 1.08rem;
  background: #fff;
  color: #333;
  outline: none;
  transition: border 0.18s;
  margin-bottom: 0.1rem;
}
.catat-input:focus, .catat-select:focus {
  border-color: #ff5fa2;
  box-shadow: 0 0 0 2px #ffe4f1;
}
.catat-form-row {
  display: flex;
  gap: 1rem;
}
.catat-form-row > div { flex: 1; }
.catat-btn {
  width: 100%;
  background: #ff5fa2;
  color: #fff;
  font-weight: bold;
  font-size: 1.08rem;
  border: none;
  border-radius: 12px;
  padding: 0.95rem 0;
  margin-top: 0.2rem;
  box-shadow: 0 2px 8px rgba(255,95,162,0.10);
  transition: background 0.18s;
}
.catat-btn:active, .catat-btn:hover {
  background: #e94e8f;
}
.catat-error {
  color: #e94e8f;
  font-size: 0.98rem;
  text-align: center;
  margin-top: 0.2rem;
}
@media (max-width: 480px) {
  .catat-form-row { flex-direction: column; gap: 0.5rem; }
  .max-w-md { padding: 0 0.2rem; }
}
.relative { position: relative; }
.icon-calendar, .icon-clock { display: flex; align-items: center; }
.pr-10 { padding-right: 2.5rem; }
.animate-slideUpModal {
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
}
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>

<div class="page-root">
  <main>
    <div class="px-3 py-4">
      <div class="max-w-md mx-auto w-full pt-2 pb-8 px-2">
        <div class="flex rounded-full overflow-hidden mb-5 shadow-sm border border-pink-100 bg-[#f9f9fb]">
          <button class="catat-tab {mode === 'pemasukan' ? 'active' : ''}" type="button" on:click={() => { mode = 'pemasukan'; jenis = 'pendapatan_usaha'; namaJenis = ''; nama = ''; }}>Catat Pemasukan</button>
          <button class="catat-tab {mode === 'pengeluaran' ? 'active' : ''}" type="button" on:click={() => { mode = 'pengeluaran'; jenis = 'beban_usaha'; namaJenis = ''; nama = ''; }}>Catat Pengeluaran</button>
        </div>
        <form class="flex flex-col gap-4 bg-white rounded-2xl shadow p-5 border border-pink-100" on:submit|preventDefault={handleSubmit} autocomplete="off">
          <div class="catat-form-row">
            <div>
              <label class="catat-form-label" for="tanggal-input">Tanggal</label>
              <input
                id="tanggal-input"
                type="date"
                class="catat-input"
                bind:value={date}
                min="2020-01-01"
                max="2100-12-31"
                required
              />
            </div>
            <div>
              <label class="catat-form-label" for="waktu-input">Waktu</label>
              <input
                id="waktu-input"
                type="time"
                class="catat-input"
                bind:value={time}
                required
              />
            </div>
          </div>
          <div>
            <label class="catat-form-label">Nominal (Rp)</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="catat-input"
              value={nominal}
              on:input={handleNominalInput}
              required
              placeholder="Masukkan nominal"
              autocomplete="off"
            />
            <div class="flex flex-col items-center mt-2 mb-1">
              <div class="grid grid-cols-3 gap-2 w-full max-w-xs">
                <button type="button" class="px-0 py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 w-full" on:click={() => setTemplateNominal(5000)}>5.000</button>
                <button type="button" class="px-0 py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 w-full" on:click={() => setTemplateNominal(10000)}>10.000</button>
                <button type="button" class="px-0 py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 w-full" on:click={() => setTemplateNominal(20000)}>20.000</button>
                <button type="button" class="px-0 py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 w-full" on:click={() => setTemplateNominal(50000)}>50.000</button>
                <button type="button" class="px-0 py-2 rounded-lg bg-pink-100 text-pink-500 font-semibold text-base shadow-sm active:bg-pink-200 w-full" on:click={() => setTemplateNominal(100000)}>100.000</button>
                <div></div>
              </div>
            </div>
          </div>
          <div>
            <label class="catat-form-label">Jenis {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <div class="catat-input flex items-center cursor-pointer" on:click={() => showDropdown = true} tabindex="0" style="user-select:none;">
              <span class="truncate">{getJenisLabel(jenis)}</span>
            </div>
            <DropdownSheet open={showDropdown} value={jenis} options={mode === 'pemasukan' ? jenisPemasukan : jenisPengeluaran} on:close={() => showDropdown = false} on:select={e => { jenis = e.detail; showDropdown = false; }} />
          </div>
          {#if jenis === 'lainnya'}
            <div>
              <label class="catat-form-label">Nama Jenis</label>
              <input type="text" class="catat-input" bind:value={namaJenis} required placeholder="Masukkan nama jenis" />
            </div>
          {/if}
          <div>
            <label class="catat-form-label">Nama {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label>
            <input type="text" class="catat-input" bind:value={nama} required placeholder="Contoh: Modal Awal, Listrik, Dll" />
          </div>
          {#if error}
            <div class="catat-error">{error}</div>
          {/if}
          <button type="submit" class="catat-btn">Simpan</button>
        </form>
      </div>
    </div>
  </main>
</div> 