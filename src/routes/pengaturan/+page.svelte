<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.js';
  import { SecurityMiddleware } from '$lib/security.js';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import Crown from 'lucide-svelte/icons/crown';
  import CreditCard from 'lucide-svelte/icons/credit-card';
  import LogOut from 'lucide-svelte/icons/log-out';
  import Shield from 'lucide-svelte/icons/shield';
  import Palette from 'lucide-svelte/icons/palette';
  import Database from 'lucide-svelte/icons/database';
  import HelpCircle from 'lucide-svelte/icons/help-circle';
  import Settings from 'lucide-svelte/icons/settings';
  import Bell from 'lucide-svelte/icons/bell';
  import User from 'lucide-svelte/icons/user';
  import Download from 'lucide-svelte/icons/download';
  import Printer from 'lucide-svelte/icons/printer';
  import { supabase } from '$lib/database/supabaseClient';

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session:', session);
    const userId = session?.user?.id;
    if (userId) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();
      console.log('Profile:', profile, 'Error:', error);
      userRole = profile?.role || '';
      userName = profile?.full_name || '';
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        canInstallPWA = true;
      });
    }
    if (userRole === 'kasir') {
      const { data } = await supabase.from('security_settings').select('locked_pages, pin').single();
      const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
      pin = data?.pin || '1234';
      if (lockedPages.includes('pengaturan')) {
        showPinModal = true;
      }
      console.log('userRole', userRole);
      console.log('lockedPages', lockedPages);
      console.log('showPinModal', showPinModal);
    }
  });

  let currentUser = null;
  let showLogoutModal = false;
  let deferredPrompt = null;
  let canInstallPWA = false;
  let currentPage = 'security';
  let userRole = '';
  let userName = '';
  let showPinModal = false;
  let pin = '';
  let pinInput = '';
  let pinError = '';
  let errorTimeout: number;
  let isClosing = false;

  function handleLogout() {
    showLogoutModal = true;
  }

  function confirmLogout() {
    SecurityMiddleware.logSecurityEvent('user_logout', {
      user: currentUser?.username,
      from: 'settings_page'
    });
    auth.logout();
    goto('/login');
  }

  function cancelLogout() {
    showLogoutModal = false;
  }

  function getRoleIcon() {
    if (userRole === 'admin' || userRole === 'pemilik') return Crown;
    if (userRole === 'kasir') return CreditCard;
    return User;
  }

  function getRoleLabel() {
    if (userRole === 'admin' || userRole === 'pemilik') return 'Pemilik';
    if (userRole === 'kasir') return 'Kasir';
    return 'User';
  }

  function getRoleDesc() {
    if (userRole === 'admin' || userRole === 'pemilik') return 'Akses penuh ke seluruh sistem';
    if (userRole === 'kasir') return 'Akses standar';
    return 'Akses standar';
  }

  function getRoleColor() {
    if (userRole === 'admin' || userRole === 'pemilik') {
      return 'from-purple-500 to-pink-500';
    } else if (userRole === 'kasir') {
      return 'from-green-500 to-blue-500';
    }
    return 'from-gray-500 to-gray-600';
  }

  function getRoleBadgeColor() {
    if (userRole === 'admin' || userRole === 'pemilik') {
      return 'bg-purple-100 text-purple-800';
    } else if (userRole === 'kasir') {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  }

  function getRoleDescription() {
    if (userRole === 'admin' || userRole === 'pemilik') {
      return 'Akses penuh ke semua fitur sistem';
    } else if (userRole === 'kasir') {
      return 'Akses terbatas untuk POS dan laporan';
    }
    return 'Akses standar';
  }

  function handleInstallPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        canInstallPWA = false;
      });
    } else {
      alert('Fitur install PWA tidak tersedia di browser ini.');
    }
  }

  const settingsSections = [
    {
      title: 'Akun & Keamanan',
      icon: Shield,
      items: [
        { label: 'Profil Pengguna', icon: User, action: () => alert('Fitur profil belum tersedia') },
        { label: 'Ubah Password', icon: Shield, action: () => alert('Fitur ubah password belum tersedia') },
        { label: 'Riwayat Login', icon: Bell, action: () => alert('Fitur riwayat login belum tersedia') }
      ]
    },
    {
      title: 'Tampilan & Tema',
      icon: Palette,
      items: [
        { label: 'Tema Aplikasi', icon: Palette, action: () => alert('Fitur tema belum tersedia') },
        { label: 'Ukuran Font', icon: Settings, action: () => alert('Fitur ukuran font belum tersedia') },
        { label: 'Animasi', icon: Settings, action: () => alert('Fitur animasi belum tersedia') }
      ]
    },
    {
      title: 'Data & Backup',
      icon: Database,
      items: [
        { label: 'Export Data', icon: Database, action: () => alert('Fitur export data belum tersedia') },
        { label: 'Import Data', icon: Database, action: () => alert('Fitur import data belum tersedia') },
        { label: 'Backup Otomatis', icon: Settings, action: () => alert('Fitur backup belum tersedia') }
      ]
    },
    {
      title: 'Bantuan & Dukungan',
      icon: HelpCircle,
      items: [
        { label: 'Panduan Penggunaan', icon: HelpCircle, action: () => alert('Panduan belum tersedia') },
        { label: 'Hubungi Support', icon: Bell, action: () => alert('Support belum tersedia') },
        { label: 'Tentang Aplikasi', icon: Settings, action: () => alert('Versi 1.0.0 - Zatiaras Juice POS') }
      ]
    }
  ];

  // Filter sections based on user role
  $: filteredSections = (userRole === 'admin' || userRole === 'pemilik') 
    ? settingsSections 
    : settingsSections.filter(section => section.title !== 'Data & Backup');
  
  // Get role icon once and store it
  $: roleIcon = getRoleIcon();

  // Tambahkan fungsi upload gambar menu ke bucket 'gambar-menu' Supabase Storage
  async function uploadMenuImage(file, menuId) {
    const ext = file.name.split('.').pop();
    const filePath = `menu-${menuId}-${Date.now()}.${ext}`;
    // Upload ke bucket 'gambar-menu'
    const { data, error } = await supabase.storage.from('gambar-menu').upload(filePath, file, { upsert: true });
    if (error) throw error;
    // Dapatkan public URL
    const { data: publicUrlData } = supabase.storage.from('gambar-menu').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  }
</script>

<svelte:head>
  <title>ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col page-content">
  <!-- Button Kembali -->
  <div class="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-lg border-b border-gray-100 mt-0 mx-0 mb-2 px-4 py-3 flex items-center" style="min-height:56px">
    <button on:click={() => goto('/')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
      {#if ArrowLeft}
        <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
      {:else}
        <div class="w-5 h-5 flex items-center justify-center">
          <span class="block w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
        </div>
      {/if}
    </button>
  </div>
  <!-- Box Informasi Role -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mx-4 flex flex-col items-center gap-2 mb-2">
    <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-2">
      {#if roleIcon}
        <svelte:component this={roleIcon} class="w-8 h-8 text-white" />
      {:else}
        <div class="w-8 h-8 flex items-center justify-center">
          <span class="block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        </div>
      {/if}
    </div>
    {#if userRole === 'admin' || userRole === 'pemilik'}
      <div class="text-2xl font-extrabold text-purple-700 mb-1">Pemilik</div>
      <div class="text-sm text-gray-600 mb-2">Akses penuh ke seluruh sistem</div>
      <div class="flex items-center justify-between w-full text-xs text-gray-500 mt-2">
        <span>Login terakhir: {new Date().toLocaleString('id-ID')}</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>Session aktif</span>
      </div>
    {:else if userRole === 'kasir'}
      <div class="text-2xl font-extrabold text-green-700 mb-1">Kasir</div>
      <div class="text-sm text-gray-600 mb-2">Akses standar</div>
      <div class="flex items-center justify-between w-full text-xs text-gray-500 mt-2">
        <span>Login terakhir: {new Date().toLocaleString('id-ID')}</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>Session aktif</span>
      </div>
    {/if}
  </div>

  <!-- Grid Menu Pengaturan -->
  <div class="flex-1 flex flex-col justify-center items-center px-4 mt-0">
    <div class="grid grid-cols-2 gap-4 w-full max-w-md mt-2">
      {#if userRole === ''}
        {#each Array(2) as _, i}
          <div class="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 animate-pulse rounded-xl shadow-lg border-2 border-gray-100 flex flex-col items-center justify-center aspect-square min-h-[110px] p-4">
            <div class="w-8 h-8 mb-2 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 rounded-lg"></div>
          </div>
        {/each}
      {:else}
        <!-- Box Pemilik (selalu tampil, disable jika bukan admin/pemilik) -->
        <button
          class="relative bg-gradient-to-br from-purple-500 to-pink-400 rounded-xl shadow-lg border-2 border-purple-400 flex flex-col items-center justify-center aspect-square min-h-[110px] p-4 text-white focus:outline-none transition-opacity duration-200"
          on:click={() => (userRole === 'admin' || userRole === 'pemilik') && goto('/pengaturan/pemilik')}
          disabled={userRole !== 'admin' && userRole !== 'pemilik'}
          class:opacity-60={userRole !== 'admin' && userRole !== 'pemilik'}
          class:pointer-events-none={userRole !== 'admin' && userRole !== 'pemilik'}
        >
          {#if Crown}
            <svelte:component this={Crown} class="w-8 h-8 mb-2" />
          {:else}
            <div class="w-8 h-8 mb-2 flex items-center justify-center">
              <span class="block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            </div>
          {/if}
          <div class="text-lg font-bold mb-1">Pemilik</div>
          <span class="inline-block bg-white/20 text-xs font-semibold px-3 py-1 rounded-full mb-2 border border-white/30">Privileged</span>
          <div class="text-xs text-white/80 text-center">Akses penuh ke seluruh sistem</div>
        </button>
        <!-- Box Kasir (menu biasa) -->
        <button class="bg-white rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center aspect-square min-h-[110px] p-4 focus:outline-none">
          {#if CreditCard}
            <svelte:component this={CreditCard} class="w-8 h-8 mb-2 text-green-500" />
          {:else}
            <div class="w-8 h-8 mb-2 flex items-center justify-center">
              <span class="block w-6 h-6 border-2 border-green-200 border-t-green-500 rounded-full animate-spin"></span>
            </div>
          {/if}
          <div class="text-lg font-bold mb-1 text-gray-800">Kasir</div>
          <span class="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full mb-2">Menu</span>
          <div class="text-xs text-gray-500 text-center">Pengaturan kasir</div>
        </button>
        <!-- Box Install PWA -->
        <button class="bg-white rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center aspect-square min-h-[110px] p-4 focus:outline-none disabled:opacity-60" on:click={handleInstallPWA} disabled={!canInstallPWA}>
          {#if Download}
            <svelte:component this={Download} class="w-8 h-8 mb-2 text-pink-500" />
          {:else}
            <div class="w-8 h-8 mb-2 flex items-center justify-center">
              <span class="block w-6 h-6 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
            </div>
          {/if}
          <div class="text-lg font-bold mb-1 text-pink-500">Install PWA</div>
          <span class="inline-block bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full mb-2">Aplikasi</span>
          <div class="text-xs text-gray-500 text-center">Pasang ke Home Screen</div>
        </button>
        <!-- Box Printer -->
        <button class="bg-white rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center aspect-square min-h-[110px] p-4 focus:outline-none" on:click={() => goto('/pengaturan/printer')}>
          {#if Printer}
            <svelte:component this={Printer} class="w-8 h-8 mb-2 text-blue-500" />
          {:else}
            <div class="w-8 h-8 mb-2 flex items-center justify-center">
              <span class="block w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></span>
            </div>
          {/if}
          <div class="text-lg font-bold mb-1 text-blue-700">Printer</div>
          <span class="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-2">Bluetooth</span>
          <div class="text-xs text-gray-500 text-center">Koneksikan printer Bluetooth</div>
        </button>
      {/if}
    </div>
  </div>

  <!-- Logout Section -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-200 mx-4 mb-6 mt-4 overflow-hidden">
    <div class="px-6 py-4 bg-red-50 border-b border-red-200">
      <div class="flex items-center gap-3">
        {#if LogOut}
          <svelte:component this={LogOut} class="w-5 h-5 text-red-600" />
        {:else}
          <div class="w-5 h-5 flex items-center justify-center">
            <span class="block w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></span>
          </div>
        {/if}
        <h3 class="font-semibold text-red-800">Keluar dari Sistem</h3>
      </div>
    </div>
    <div class="p-6">
      <p class="text-sm text-gray-600 mb-4">
        Anda akan keluar dari sistem dan harus login kembali untuk mengakses aplikasi.
      </p>
      <button
        on:click={handleLogout}
        class="w-full bg-red-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
      >
        {#if LogOut}
          <svelte:component this={LogOut} class="w-4 h-4" />
        {:else}
          <div class="w-4 h-4 flex items-center justify-center">
            <span class="block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          </div>
        {/if}
        Keluar dari Sistem
      </button>
    </div>
  </div>

  <!-- Logout Confirmation Modal -->
  {#if showLogoutModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            {#if LogOut}
              <svelte:component this={LogOut} class="w-5 h-5 text-red-600" />
            {:else}
              <div class="w-5 h-5 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></span>
              </div>
            {/if}
          </div>
          <div>
            <h3 class="font-semibold text-gray-800">Konfirmasi Logout</h3>
            <p class="text-sm text-gray-600">Apakah Anda yakin ingin keluar?</p>
          </div>
        </div>
        <div class="flex gap-3">
          <button
            on:click={cancelLogout}
            class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            on:click={confirmLogout}
            class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- App Info -->
<div class="text-center py-4">
  <p class="text-xs text-gray-500">
    ZatiarasPOS v1.0
  </p>
  <p class="text-xs text-gray-400 mt-1">
    © 2024 Zatiaras Juice.
  </p>
</div> 