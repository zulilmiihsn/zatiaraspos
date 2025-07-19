<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import { userRole } from '$lib/stores/userRole';
let Utensils, Shield;
onMount(() => {
  userRole.subscribe(role => {
    if (role !== 'pemilik') {
      goto('/unauthorized');
    }
  })();
});
onMount(async () => {
  Utensils = (await import('lucide-svelte/icons/utensils')).default;
  Shield = (await import('lucide-svelte/icons/shield')).default;
});
</script>

<svelte:head>
  <title>Admin Panel - ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col page-content">
  <!-- Header -->
  <div class="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-4xl mx-auto px-4 py-4">
      <div class="flex items-center">
        <button onclick={() => goto('/pengaturan')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
          <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
        </button>
        <h1 class="ml-4 text-xl font-bold text-gray-800">Pengaturan Pemilik</h1>
      </div>
    </div>
  </div>

  <!-- Main Menu -->
  <div class="max-w-lg mx-auto px-4 py-2">
    <div class="grid grid-cols-2 gap-2 w-full">
      <a href="/pengaturan/pemilik/manajemenmenu" class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all hover:border-pink-300 group text-left flex flex-col justify-center" style="text-decoration:none;">
        <div class="flex items-center gap-2 mb-2">
          <svelte:component this={Utensils} class="w-5 h-5 text-pink-500" />
          <h3 class="text-sm font-semibold text-gray-800">Manajemen Menu</h3>
        </div>
        <p class="text-xs text-gray-500 leading-tight">Kelola menu, kategori, dan ekstra toko</p>
      </a>
      <a href="/pengaturan/pemilik/gantikeamanan" class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all hover:border-blue-300 group text-left flex flex-col justify-center" style="text-decoration:none;">
        <div class="flex items-center gap-2 mb-2">
          <svelte:component this={Shield} class="w-5 h-5 text-blue-500" />
          <h3 class="text-sm font-semibold text-gray-800 leading-tight">Ganti Keamanan</h3>
        </div>
        <p class="text-xs text-gray-500 leading-tight">Ubah password dan pengaturan keamanan</p>
      </a>
      <a href="/pengaturan/pemilik/riwayat" class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all hover:border-yellow-300 group text-left flex flex-col justify-center" style="text-decoration:none;">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 class="text-sm font-semibold text-gray-800 leading-tight">Riwayat Transaksi</h3>
        </div>
        <p class="text-xs text-gray-500 leading-tight">Lihat & hapus transaksi hari ini</p>
      </a>
      <div></div>
    </div>
  </div>
</div>