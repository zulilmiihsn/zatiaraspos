<script lang="ts">
import { onMount } from 'svelte';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { goto } from '$app/navigation';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import ToastNotification from '$lib/components/shared/toastNotification.svelte';
import { createToastManager } from '$lib/utils/index';
let namaToko = '';
let alamat = '';
let telepon = '';
let instagram = '';
let ucapan = '';
let isSaving = false;

const defaultData = {
  namaToko: 'Zatiaras Juice',
  alamat: 'Jl. Contoh Alamat No. 123, Kota',
  telepon: '0812-3456-7890',
  instagram: '@zatiarasjuice',
  ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
};

async function loadPengaturan() {
  // Coba load dari Supabase, fallback ke localStorage
  try {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('pengaturan').select('*').eq('id', 1).single();
    if (data) {
      namaToko = data.nama_toko || defaultData.namaToko;
      alamat = data.alamat || defaultData.alamat;
      telepon = data.telepon || defaultData.telepon;
      instagram = data.instagram || defaultData.instagram;
      ucapan = data.ucapan || defaultData.ucapan;
    }
  } catch {
    // loadFromLocal();
  }
}

function resetToDefault() {
  namaToko = defaultData.namaToko;
  alamat = defaultData.alamat;
  telepon = defaultData.telepon;
  instagram = defaultData.instagram;
  ucapan = defaultData.ucapan;
}

async function simpanPengaturan(event: Event) {
  event.preventDefault();
  isSaving = true;
  const data = {
    id: 1, // Always use id=1 for single row
    nama_toko: namaToko,
    alamat,
    telepon,
    instagram,
    ucapan
  };
  try {
    const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('pengaturan').upsert([data]);
    if (error) throw error;
    toastManager.showToastNotification('Pengaturan berhasil disimpan!', 'success');
  } catch (e) {
    toastManager.showToastNotification('Gagal menyimpan ke Supabase.', 'error');
  } finally {
    isSaving = false;
  }
}

// Toast management
const toastManager = createToastManager();


onMount(async () => {
  loadPengaturan();
});
</script>

<!-- Top Bar Custom -->
<div class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-4">
  <button onclick={() => goto('/pengaturan')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
    <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
  </button>
  <h1 class="text-xl font-bold text-gray-800">Pengaturan Draft Struk</h1>
</div>

<div class="min-h-screen bg-gray-50 page-content">
  <div class="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 md:p-10">
    <h1 class="text-lg font-bold text-pink-600 mb-6 text-center">Pengaturan Draft Struk</h1>
    <form class="space-y-5" onsubmit={simpanPengaturan}>
      <div>
        <label for="nama-toko" class="block text-sm font-semibold text-gray-700 mb-1">Nama Toko</label>
        <input type="text" id="nama-toko" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={namaToko} maxlength="50" required />
            </div>
      <div>
        <label for="alamat" class="block text-sm font-semibold text-gray-700 mb-1">Alamat</label>
        <input type="text" id="alamat" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={alamat} maxlength="100" required />
              </div>
      <div>
        <label for="telepon" class="block text-sm font-semibold text-gray-700 mb-1">Nomor Telepon</label>
        <input type="text" id="telepon" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={telepon} maxlength="20" required />
          </div>
      <div>
        <label for="instagram" class="block text-sm font-semibold text-gray-700 mb-1">Instagram</label>
        <input type="text" id="instagram" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={instagram} maxlength="30" />
        </div>
      <div>
        <label for="ucapan" class="block text-sm font-semibold text-gray-700 mb-1">Ucapan di Bawah Struk</label>
        <textarea id="ucapan" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" rows="3" bind:value={ucapan} maxlength="120"></textarea>
            </div>
      <div class="flex flex-col sm:flex-row gap-3 mt-6">
        <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg px-6 py-2 border border-gray-200 w-full sm:w-1/2 order-1 sm:order-1" onclick={resetToDefault} disabled={isSaving}>Reset ke Default</button>
        <button type="submit" class="bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg px-6 py-2 transition-colors disabled:opacity-50 w-full sm:w-1/2 order-2 sm:order-2" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </form>
    <div class="mt-10">
      <div class="font-semibold text-gray-700 mb-2">Preview Struk</div>
      <div class="bg-gray-50 border border-pink-200 rounded-lg p-4 text-sm font-mono whitespace-pre-line" style="max-width:350px;font-size:24px;line-height:2.0;">
        <div style="text-align:center;margin-bottom:16px;line-height:1.5;">
          <div style="font-weight:bold;font-size:26px;">{namaToko}</div>
          <div style="font-weight:bold;font-size:18px;">{alamat}</div>
          {#if instagram || telepon}
            <div style="font-weight:bold;font-size:18px;">{instagram}{instagram && telepon ? ' ' : ''}{telepon}</div>
          {/if}
        </div>
        <div style="border-bottom:1px dashed #000;margin-bottom:16px;"></div>
        <div style="text-align:left;font-weight:normal;margin-bottom:16px;line-height:1.5;">
          nama pelanggan<br/>
          01/01/2024 10.00<br/>
        </div>
        <table style="width:100%;font-size:24px;margin-bottom:16px;"><tbody>
          <tr style="line-height:1.5;"><td style="text-align:left;">Jus Mangga x2</td><td style="text-align:right;">Rp20.000</td></tr>
          <tr style="line-height:1.5;"><td style="font-size:18px;padding-left:8px;color:#000;">+ Topping Nata</td><td style="font-size:18px;text-align:right;color:#000;">Rp4.000</td></tr>
          <tr style="line-height:1.5;"><td colspan="2" style="font-size:18px;padding-left:8px;color:#000;">Tanpa Gula, Sedikit Es, Catatan khusus</td></tr>
          <tr><td colspan="2" style="height:20px;"></td></tr>
          <tr style="line-height:1.5;"><td style="text-align:left;">Jus Alpukat x1</td><td style="text-align:right;">Rp15.000</td></tr>
        </tbody></table>
        <div style="border-bottom:1px dashed #000;margin-bottom:16px;"></div>
        <table style="width:100%;font-size:24px;margin-bottom:16px;line-height:1.5;"><tbody>
          <tr><td style="text-align:left;">Total:</td><td style="text-align:right;"><b>Rp35.000</b></td></tr>
          <tr><td style="text-align:left;">Metode:</td><td style="text-align:right;">Tunai</td></tr>
          <tr><td style="text-align:left;">Dibayar:</td><td style="text-align:right;">Rp50.000</td></tr>
          <tr><td style="text-align:left;">Kembalian:</td><td style="text-align:right;">Rp15.000</td></tr>
        </tbody></table>
        <div style="margin-top:16px;text-align:center;white-space:pre-line;line-height:1.5;">{ucapan}</div>
      </div>
    </div>
  </div>
</div> 

{#if toastManager.showToast}
  <ToastNotification
    show={toastManager.showToast}
    message={toastManager.toastMessage}
    type={toastManager.toastType}
    duration={2000}
    position="top"
  />
{/if} 