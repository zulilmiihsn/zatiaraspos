<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { fly } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { userRole, setUserRole } from '$lib/stores/userRole';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import Shield from 'lucide-svelte/icons/shield';
import User from 'lucide-svelte/icons/user';

let currentUserRole = '';
let oldUsername = '';
let newUsername = '';
let oldPassword = '';
let newPassword = '';
let confirmPassword = '';
let userPassError = '';

let oldPin = '';
let newPin = '';
let confirmPin = '';
let lockedPages: string[] = [];
let pinError = '';
let pin = '';
let pengaturanKeamananId = '';
let activeSecurityTab = 'pemilik'; // 'pemilik' atau 'kasir'
let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning'; // 'warning' | 'success' | 'error'



onMount(async () => {
  userRole.subscribe(role => {
    if (role !== 'pemilik') {
      goto('/unauthorized');
    }
    currentUserRole = role || '';
  });
  // Fetch PIN dan lockedPages dari Supabase
  const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('pengaturan').select('id, pin, locked_pages').eq('id', 1).single();
  if (!error && data) {
    pin = data.pin || '';
    lockedPages = data.locked_pages || [];
    pengaturanKeamananId = data.id;
  }
});

async function handleChangeUserPass(e) {
  e.preventDefault();
  userPassError = '';
  if (!oldUsername || !newUsername || !oldPassword || !newPassword || !confirmPassword) {
    userPassError = 'Semua field wajib diisi.';
    return;
  }
  if (newPassword !== confirmPassword) {
    userPassError = 'Konfirmasi password tidak cocok.';
    return;
  }
  if (oldUsername === newUsername) {
    userPassError = 'Username baru tidak boleh sama dengan username lama.';
    return;
  }
  try {
    const branch = storeGet(selectedBranch);
    const res = await fetch('/api/ganti-keamanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameLama: oldUsername,
        usernameBaru: newUsername,
        passwordLama: oldPassword,
        passwordBaru: newPassword,
        branch
      })
    });
    const data = await res.json();
    if (!data.success) {
      userPassError = data.message || 'Gagal update username/password.';
      return;
    }
    userPassError = '';
    notifModalMsg = 'Perubahan username/password berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
    oldUsername = '';
    newUsername = '';
    oldPassword = '';
    newPassword = '';
    confirmPassword = '';
  } catch (err) {
    userPassError = 'Terjadi error pada server.';
  }
}

async function savePinSettings(event) {
  event.preventDefault();
  if (!oldPin.trim() || !newPin.trim() || !confirmPin.trim()) {
    pinError = 'Semua field wajib diisi.';
    return;
  }
  if (newPin !== confirmPin) {
    pinError = 'Konfirmasi PIN tidak cocok.';
    return;
  }
  if (newPin.length < 4 || newPin.length > 6 || !/^[0-9]+$/.test(newPin)) {
    pinError = 'PIN harus 4-6 digit angka.';
    return;
  }
  if (oldPin !== pin) {
    pinError = 'PIN lama salah.';
    return;
  }
  try {
    const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('pengaturan').update({ pin: newPin }).eq('id', pengaturanKeamananId);
    if (error) throw error;
    notifModalMsg = 'Perubahan PIN berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
    oldPin = '';
    newPin = '';
    confirmPin = '';
    pinError = '';
    pin = newPin;
  } catch (error) {
    pinError = 'Gagal menyimpan perubahan: ' + error.message;
  }
}

function closeNotifModal() {
  showNotifModal = false;
}

function handleBackToPengaturan() { goto('/pengaturan/pemilik'); }
function handleSetTabPemilik() { activeSecurityTab = 'pemilik'; }
function handleSetTabKasir() { activeSecurityTab = 'kasir'; }

// Simpan pengaturan lockedPages ke Supabase
async function saveLockedPages() {
  try {
    const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('pengaturan').update({ locked_pages: lockedPages }).eq('id', pengaturanKeamananId);
    if (error) throw error;
    notifModalMsg = 'Pengaturan halaman terkunci berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
  } catch (error) {
    notifModalMsg = 'Gagal menyimpan pengaturan: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}
</script>

<div class="min-h-screen bg-gray-50 flex flex-col" transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
  <!-- Top Bar -->
  <div class="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center px-4 py-4">
    <button onclick={handleBackToPengaturan} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
      <ArrowLeft class="w-5 h-5 text-gray-600" />
    </button>
    <h1 class="text-xl font-bold text-gray-800">Ganti Keamanan</h1>
  </div>
  <div class="max-w-md w-full mx-auto px-4 py-3 flex-1 lg:max-w-6xl lg:px-8">
    <!-- Grid layout for desktop -->
    <div class="lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 space-y-8">
    <!-- Card: Ganti Username/Password untuk Pemilik & Kasir -->
      <div class="bg-white rounded-2xl shadow p-6 mb-8 lg:mb-0 lg:flex lg:flex-col">
      <div class="flex gap-2 mb-4">
        <button
          class="flex-1 py-2 rounded-lg font-bold text-base transition-all focus:outline-none {activeSecurityTab === 'pemilik' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'}"
          onclick={handleSetTabPemilik}
          type="button"
        >
          <User class="inline w-5 h-5 mr-1" /> Pemilik
        </button>
        <button
          class="flex-1 py-2 rounded-lg font-bold text-base transition-all focus:outline-none {activeSecurityTab === 'kasir' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}"
          onclick={handleSetTabKasir}
          type="button"
        >
          <Shield class="inline w-5 h-5 mr-1" /> Kasir
        </button>
      </div>
      {#if activeSecurityTab === 'pemilik'}
        <h3 class="font-bold text-lg text-pink-600 mb-1 flex items-center gap-2">
          <User class="w-5 h-5" /> Ganti Username & Password Pemilik
        </h3>
        <p class="text-gray-500 text-sm mb-4">
          Ubah username dan password akun pemilik untuk keamanan akses penuh aplikasi.
        </p>
        <form class="flex flex-col gap-4 lg:flex-1 lg:flex lg:flex-col" onsubmit={handleChangeUserPass} autocomplete="off">
            <div class="lg:flex-1 lg:flex lg:flex-col lg:justify-start">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Username Lama</label>
            <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Username Lama" bind:value={oldUsername} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Username Baru</label>
            <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Username Baru" bind:value={newUsername} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
            <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Password Lama" bind:value={oldPassword} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Password Baru" bind:value={newPassword} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
            <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Konfirmasi Password Baru" bind:value={confirmPassword} required />
          </div>
        {#if userPassError}
            <div class="text-pink-600 text-xs text-center mt-1">{userPassError}</div>
          {/if}
            </div>
            <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2 lg:mt-auto" type="submit">Simpan Perubahan</button>
        </form>
      {:else}
          <div class="text-center py-8 lg:flex-1 lg:flex lg:flex-col lg:justify-center">
          <Shield class="w-16 h-16 text-blue-300 mx-auto mb-4" />
          <h3 class="font-bold text-lg text-blue-600 mb-2">Fitur Kasir</h3>
          <p class="text-gray-500 text-sm">Fitur ganti username & password kasir akan segera hadir.</p>
        </div>
      {/if}
    </div>
    <!-- Card: Ganti PIN -->
      <div class="bg-white rounded-2xl shadow p-6 mb-8 lg:mb-0 lg:flex lg:flex-col">
      <h3 class="font-bold text-lg text-pink-600 mb-4 flex items-center gap-2">
        <Shield class="w-5 h-5" /> Ganti PIN Keamanan
      </h3>
      <p class="text-gray-500 text-sm mb-4">
        Ubah PIN keamanan untuk mengunci akses ke halaman penting. PIN harus 4-6 digit angka.
      </p>
        <form class="flex flex-col gap-4 lg:flex-1 lg:flex lg:flex-col" onsubmit={savePinSettings} autocomplete="off">
          <div class="lg:flex-1 lg:flex lg:flex-col lg:justify-start">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">PIN Lama</label>
          <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="PIN Lama" bind:value={oldPin} required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">PIN Baru</label>
          <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="PIN Baru" bind:value={newPin} required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi PIN Baru</label>
          <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100" placeholder="Konfirmasi PIN Baru" bind:value={confirmPin} required />
        </div>
        {#if pinError}
          <div class="text-pink-600 text-xs text-center mt-1">{pinError}</div>
        {/if}
          </div>
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2 lg:mt-auto" type="submit">Simpan PIN</button>
      </form>
    </div>
    <!-- Card: Pengaturan Halaman Terkunci -->
      <div class="bg-white rounded-2xl shadow p-6 mb-8 lg:mb-0 lg:flex lg:flex-col">
      <h3 class="font-bold text-lg text-pink-600 mb-4 flex items-center gap-2">
        <Shield class="w-5 h-5" /> Pengaturan Halaman Terkunci
      </h3>
      <p class="text-gray-500 text-sm mb-6">Pilih halaman yang ingin dikunci dengan PIN. Halaman yang dikunci akan meminta PIN saat diakses.</p>
        <div class="lg:flex-1 lg:flex lg:flex-col lg:justify-start">
      <div class="flex flex-col gap-3 mb-4">
        <label class="flex items-center gap-3 cursor-pointer select-none">
          <span class="relative inline-block w-5 h-5">
            <input type="checkbox" bind:group={lockedPages} value="beranda" class="peer absolute opacity-0 w-5 h-5 cursor-pointer" />
            <span class="block w-5 h-5 rounded-full border-2 border-pink-400 bg-white peer-checked:bg-pink-500 transition-colors duration-200"></span>
          </span>
          <span class="text-gray-700 font-medium">Beranda</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer select-none">
          <span class="relative inline-block w-5 h-5">
            <input type="checkbox" bind:group={lockedPages} value="catat" class="peer absolute opacity-0 w-5 h-5 cursor-pointer" />
            <span class="block w-5 h-5 rounded-full border-2 border-pink-400 bg-white peer-checked:bg-pink-500 transition-colors duration-200"></span>
          </span>
          <span class="text-gray-700 font-medium">Catat</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer select-none">
          <span class="relative inline-block w-5 h-5">
            <input type="checkbox" bind:group={lockedPages} value="laporan" class="peer absolute opacity-0 w-5 h-5 cursor-pointer" />
            <span class="block w-5 h-5 rounded-full border-2 border-pink-400 bg-white peer-checked:bg-pink-500 transition-colors duration-200"></span>
          </span>
          <span class="text-gray-700 font-medium">Laporan</span>
        </label>
      </div>
        </div>
        <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2 lg:mt-auto" type="button" onclick={saveLockedPages}>Simpan Pengaturan</button>
      </div>
    </div>
    {#if showNotifModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div class="bg-white rounded-2xl shadow-2xl border-2 px-8 py-7 max-w-xs w-full flex flex-col items-center animate-slideUpModal" style="border-color: {notifModalType === 'success' ? '#facc15' : notifModalType === 'error' ? '#ef4444' : '#facc15'};">
          <div class="flex items-center justify-center w-16 h-16 rounded-full mb-3" style="background: {notifModalType === 'success' ? '#fef9c3' : notifModalType === 'error' ? '#fee2e2' : '#fef9c3'};">
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
          <div class="text-center text-base font-semibold text-gray-700 mb-2">{notifModalMsg}</div>
          <button class="w-full py-2 bg-yellow-400 text-white rounded-lg font-semibold mt-2" onclick={closeNotifModal}>Tutup</button>
        </div>
      </div>
    {/if}
  </div>
</div> 