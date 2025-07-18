<script lang="ts">
import { onMount } from 'svelte';
import { supabase } from '$lib/database/supabaseClient';
import { goto } from '$app/navigation';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
let logoUrl = 'https://zatiaraspos.vercel.app/img/144x144.png';
let namaToko = '';
let alamat = '';
let telepon = '';
let instagram = '';
let ucapan = '';
let isSaving = false;
let isUploading = false;
let previewUrl = logoUrl;
let errorMsg = '';
let successMsg = '';
let showToast = false;
let toastMsg = '';
let toastType = 'success'; // 'success' | 'error'
let toastTimeout: any = null;

const defaultData = {
  logoUrl: 'https://zatiaraspos.vercel.app/img/144x144.png',
  namaToko: 'Zatiaras Juice',
  alamat: 'Jl. Contoh Alamat No. 123, Kota',
  telepon: '0812-3456-7890',
  instagram: '@zatiarasjuice',
  ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
};

async function loadPengaturan() {
  // Coba load dari Supabase, fallback ke localStorage
  try {
    const { data, error } = await supabase.from('pengaturan_struk').select('*').limit(1).maybeSingle();
    if (data) {
      logoUrl = data.logo_url || defaultData.logoUrl;
      namaToko = data.nama_toko || defaultData.namaToko;
      alamat = data.alamat || defaultData.alamat;
      telepon = data.telepon || defaultData.telepon;
      instagram = data.instagram || defaultData.instagram;
      ucapan = data.ucapan || defaultData.ucapan;
      previewUrl = logoUrl;
    } else {
      loadFromLocal();
    }
  } catch {
    loadFromLocal();
  }
}

function loadFromLocal() {
  const local = localStorage.getItem('pengaturan_struk');
  if (local) {
    try {
      const d = JSON.parse(local);
      logoUrl = d.logoUrl || defaultData.logoUrl;
      namaToko = d.namaToko || defaultData.namaToko;
      alamat = d.alamat || defaultData.alamat;
      telepon = d.telepon || defaultData.telepon;
      instagram = d.instagram || defaultData.instagram;
      ucapan = d.ucapan || defaultData.ucapan;
      previewUrl = logoUrl;
    } catch {}
  } else {
    resetToDefault();
  }
}

function resetToDefault() {
  logoUrl = defaultData.logoUrl;
  namaToko = defaultData.namaToko;
  alamat = defaultData.alamat;
  telepon = defaultData.telepon;
  instagram = defaultData.instagram;
  ucapan = defaultData.ucapan;
  previewUrl = logoUrl;
}

function showFloatingNotif(msg: string, type: 'success' | 'error' = 'success') {
  toastMsg = msg;
  toastType = type;
  showToast = true;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { showToast = false; }, 2500);
}

async function simpanPengaturan(event: Event) {
  event.preventDefault();
  isSaving = true;
  errorMsg = '';
  successMsg = '';
  const data = {
    logo_url: logoUrl,
    nama_toko: namaToko,
    alamat,
    telepon,
    instagram,
    ucapan
  };
  try {
    const { error } = await supabase.from('pengaturan_struk').upsert([data]);
    if (error) throw error;
    localStorage.setItem('pengaturan_struk', JSON.stringify({
      logoUrl, namaToko, alamat, telepon, instagram, ucapan
    }));
    showFloatingNotif('Pengaturan berhasil disimpan!', 'success');
  } catch (e) {
    showFloatingNotif('Gagal menyimpan ke Supabase. Disimpan ke localStorage.', 'error');
    localStorage.setItem('pengaturan_struk', JSON.stringify({
      logoUrl, namaToko, alamat, telepon, instagram, ucapan
    }));
  } finally {
    isSaving = false;
  }
}

async function handleLogoUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || !files[0]) return;
  isUploading = true;
  errorMsg = '';
  const file = files[0];
  const fileExt = file.name.split('.').pop();
  const fileName = `logo_${Date.now()}.${fileExt}`;
  try {
    const { data, error } = await supabase.storage.from('public').upload(`logo/${fileName}`, file, { upsert: true });
    if (error) throw error;
    const { data: publicUrl } = supabase.storage.from('public').getPublicUrl(`logo/${fileName}`);
    logoUrl = publicUrl.publicUrl;
    previewUrl = logoUrl;
  } catch (e) {
    errorMsg = 'Gagal upload logo.';
  } finally {
    isUploading = false;
  }
}

onMount(() => {
  loadPengaturan();
});
</script>

<svelte:head>
  <title>Pengaturan Draft Struk | ZatiarasPOS</title>
</svelte:head>

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
        <label class="block text-sm font-semibold text-gray-700 mb-1">Logo</label>
        <div class="flex items-center gap-4">
          <img src={previewUrl} alt="Logo Preview" class="w-16 h-16 rounded-lg border border-gray-200 bg-white object-contain" />
          <input type="file" accept="image/*" onchange={handleLogoUpload} disabled={isUploading} class="block" />
            </div>
        <div class="text-xs text-gray-400 mt-1">Default: <a href="https://zatiaraspos.vercel.app/img/144x144.png" target="_blank" class="underline">https://zatiaraspos.vercel.app/img/144x144.png</a></div>
              </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Nama Toko</label>
        <input type="text" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={namaToko} maxlength="50" required />
          </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Alamat</label>
        <input type="text" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={alamat} maxlength="100" required />
        </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Nomor Telepon</label>
        <input type="text" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={telepon} maxlength="20" required />
            </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Instagram</label>
        <input type="text" class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" bind:value={instagram} maxlength="30" />
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Ucapan di Bawah Struk</label>
        <textarea class="w-full border-2 border-pink-200 rounded-lg px-3 py-2 text-base" rows="3" bind:value={ucapan} maxlength="120"></textarea>
    </div>
      <div class="flex flex-col sm:flex-row gap-3 mt-6">
        <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg px-6 py-2 border border-gray-200 w-full sm:w-1/2 order-1 sm:order-1" onclick={resetToDefault} disabled={isSaving}>Reset ke Default</button>
        <button type="submit" class="bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg px-6 py-2 transition-colors disabled:opacity-50 w-full sm:w-1/2 order-2 sm:order-2" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
  </div>
    </form>
    <div class="mt-10">
      <div class="font-semibold text-gray-700 mb-2">Preview Struk</div>
      <div class="bg-gray-50 border border-pink-200 rounded-lg p-4 text-sm font-mono whitespace-pre-line" style="max-width:350px;font-size:16px;line-height:1.7;">
        <div style="text-align:center;font-weight:bold;">
          <img src={previewUrl} alt="Logo" style="width:48px;height:48px;object-fit:contain;margin:0 auto 8px auto;" />
          <div>{namaToko}</div>
        </div>
        <div style="border-bottom:1px dashed #000;margin:8px 0;"></div>
        <div style="white-space:pre-line;">{alamat}</div>
        <div>Telp: {telepon}</div>
        {#if instagram}
          <div>IG: {instagram}</div>
        {/if}
        <div style="border-bottom:1px dashed #000;margin:8px 0;"></div>
        Jus Mangga x2 - Rp20.000<br/>
        + Topping Nata<br/>
        Tanpa Gula, Sedikit Es, Catatan khusus<br/>
        <br/>
        Jus Alpukat x1 - Rp15.000<br/>
        <br/>
        <div style="border-bottom:1px dashed #000;margin:8px 0;"></div>
        <div>Total: <b>Rp35.000</b></div>
        <div>Metode: Tunai</div>
        <div>Dibayar: Rp50.000</div>
        <div>Kembalian: Rp15.000</div>
        <div style="margin-top:12px;text-align:center;white-space:pre-line;">{ucapan}</div>
      </div>
    </div>
  </div>
</div> 

{#if showToast}
  <div class="fixed top-6 left-1/2 z-50 px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out text-white font-semibold"
    style="transform: translateX(-50%); background: {toastType === 'success' ? '#22c55e' : '#ef4444'}; min-width:200px; text-align:center;">
    {toastMsg}
  </div>
{/if} 