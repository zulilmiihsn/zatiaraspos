<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { userRole, setUserRole } from '$lib/stores/userRole';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import Shield from 'lucide-svelte/icons/shield';
import User from 'lucide-svelte/icons/user';
import Lock from 'lucide-svelte/icons/lock';

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
let lockedPages: string[] = ['laporan', 'beranda'];
let pinError = '';
let pin = '';
let activeSecurityTab = 'pemilik'; // 'pemilik' atau 'kasir'
let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning'; // 'warning' | 'success' | 'error'

// Tambahkan state untuk kasir
let kasirOldUsername = '';
let kasirNewUsername = '';
let kasirOldPassword = '';
let kasirNewPassword = '';
let kasirConfirmPassword = '';
let kasirUserPassError = '';

onMount(() => {
  userRole.subscribe(role => {
    currentUserRole = role || '';
  });
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
  // Ambil userId dari session
  const { data: { session } } = await getSupabaseClient(storeGet(selectedBranch)).auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    userPassError = 'Session tidak valid.';
    return;
  }
  // Update username di profiles (pakai username)
  const { error: usernameError } = await getSupabaseClient(storeGet(selectedBranch)).from('profil').update({ username: newUsername }).eq('id', userId);
  if (usernameError) {
    userPassError = 'Gagal update nama user.';
    return;
  }
  // Update password via Supabase Auth
  const { error: passError } = await getSupabaseClient(storeGet(selectedBranch)).auth.updateUser({ password: newPassword });
  if (passError) {
    userPassError = 'Gagal update password.';
    return;
  }
  userPassError = '';
  notifModalMsg = 'Perubahan username/password berhasil disimpan.';
  notifModalType = 'success';
  showNotifModal = true;
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
  if (oldPin !== '1234') { // Simulasi PIN lama
    pinError = 'PIN lama salah.';
    return;
  }
  try {
    // Simulasi update PIN
    await new Promise(resolve => setTimeout(resolve, 1000));
    notifModalMsg = 'Perubahan PIN & pengaturan kunci berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
    oldPin = '';
    newPin = '';
    confirmPin = '';
    pinError = '';
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
</script>

<svelte:head>
  <title>Ganti Keamanan | ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col">
  <!-- Top Bar -->
  <div class="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center px-4 py-4">
    <button onclick={handleBackToPengaturan} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
      <ArrowLeft class="w-5 h-5 text-gray-600" />
    </button>
    <h1 class="text-xl font-bold text-gray-800">Ganti Keamanan</h1>
  </div>
  <div class="max-w-md w-full mx-auto px-4 py-8 flex-1">
    <!-- Card: Ganti Username/Password untuk Pemilik & Kasir -->
    <div class="bg-white rounded-2xl shadow p-6 mb-8">
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
      <form class="flex flex-col gap-4" onsubmit={handleChangeUserPass} autocomplete="off">
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
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2" type="submit">Simpan Perubahan</button>
        </form>
      {:else}
        <h3 class="font-bold text-lg text-blue-600 mb-1 flex items-center gap-2">
          <Shield class="w-5 h-5" /> Ganti Username & Password Kasir
        </h3>
        <p class="text-gray-500 text-sm mb-4">
          Ubah username dan password akun kasir untuk keamanan akses kasir.
        </p>
        <form class="flex flex-col gap-4" onsubmit={handleChangeKasirUserPass} autocomplete="off">
          <div>
            <label class="block text-sm font-medium text-blue-700 mb-1">Username Lama</label>
            <input type="text" class="w-full border border-blue-300 rounded-lg px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Username Lama" bind:value={kasirOldUsername} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-blue-700 mb-1">Username Baru</label>
            <input type="text" class="w-full border border-blue-300 rounded-lg px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Username Baru" bind:value={kasirNewUsername} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-blue-700 mb-1">Password Lama</label>
            <input type="password" class="w-full border border-blue-300 rounded-lg px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Password Lama" bind:value={kasirOldPassword} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-blue-700 mb-1">Password Baru</label>
            <input type="password" class="w-full border border-blue-300 rounded-lg px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Password Baru" bind:value={kasirNewPassword} required />
          </div>
          <div>
            <label class="block text-sm font-medium text-blue-700 mb-1">Konfirmasi Password Baru</label>
            <input type="password" class="w-full border border-blue-300 rounded-lg px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Konfirmasi Password Baru" bind:value={kasirConfirmPassword} required />
          </div>
          {#if kasirUserPassError}
            <div class="text-blue-600 text-xs text-center mt-1">{kasirUserPassError}</div>
        {/if}
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 mt-2" type="submit">Simpan Perubahan</button>
      </form>
      {/if}
    </div>
    <!-- Card: Ganti PIN -->
    <div class="bg-white rounded-2xl shadow p-6 mb-8">
      <h3 class="font-bold text-lg text-pink-600 mb-4 flex items-center gap-2">
        <Shield class="w-5 h-5" /> Ganti PIN Keamanan
      </h3>
      <p class="text-gray-500 text-sm mb-4">
        Ubah PIN keamanan untuk mengunci akses ke halaman penting. PIN harus 4-6 digit angka.
      </p>
      <form class="flex flex-col gap-4" onsubmit={savePinSettings} autocomplete="off">
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
        <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2" type="submit">Simpan PIN</button>
      </form>
    </div>
    <!-- Card: Pengaturan Halaman Terkunci -->
    <div class="bg-white rounded-2xl shadow p-6 mb-8">
      <h3 class="font-bold text-lg text-pink-600 mb-4 flex items-center gap-2">
        <Lock class="w-5 h-5" /> Pengaturan Halaman Terkunci
      </h3>
      <p class="text-gray-500 text-sm mb-6">Pilih halaman yang ingin dikunci dengan PIN. Halaman yang dikunci akan meminta PIN saat diakses.</p>
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
      <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 mt-2" type="button">Simpan Pengaturan</button>
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