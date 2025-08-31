<script lang="ts">
import Settings from 'lucide-svelte/icons/settings';
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import { getPendingTransactions } from '$lib/utils/offline';

export let showSettings: boolean = true;

let pendingCount = 0;
let showPopover = false;

onMount(() => {
  getPendingTransactions().then(transactions => {
    pendingCount = transactions.length;
  });
  
  const updateCount = async () => {
    const transactions = await getPendingTransactions();
    pendingCount = transactions.length;
  };
  
  window.addEventListener('storage', updateCount);
  
  return () => {
    window.removeEventListener('storage', updateCount);
  };
});

let isOffline = !navigator.onLine;
onMount(() => {
  window.addEventListener('offline', () => isOffline = true);
  window.addEventListener('online', () => isOffline = false);
});
</script>

<div class="flex items-center justify-between px-4 pt-4 pb-3 bg-white z-10 nav-transition">
  <div class="flex items-center gap-3">
    <img class="w-[38px] h-[38px] p-1.5 rounded-lg object-contain shadow-lg shadow-pink-500/7 bg-white" src="/img/logo.svg" alt="Logo Zatiaras" />
    {#if isOffline}
      <span class="ml-2 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-600 flex items-center gap-1 shadow-sm border border-pink-200 animate-fade-in" style="min-width: 70px;">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.94 17.94A10.97 10.97 0 0112 21c-5.52 0-10-4.48-10-10 0-2.39.84-4.58 2.24-6.32M1 1l22 22M16.72 11.06A6 6 0 006.34 6.34" /></svg>
        <span class="tracking-wide">Offline</span>
      </span>
    {/if}
    {#if pendingCount > 0}
      <div class="flex items-center" style="gap: 12px;">
        <div class="w-6 h-6 flex items-center justify-center bg-yellow-400 text-white text-xs font-semibold rounded-full shadow border-2 border-white animate-pulse transition-transform duration-300" style="animation-delay: 0.2s;">
          <span class="mb-px">{pendingCount}</span>
        </div>
      </div>
    {/if}
  </div>
  <div class="flex-1 text-center text-lg font-medium text-gray-800 tracking-wide">
    <slot />
  </div>
  <slot name="actions" />
  <slot name="download" />
  <div class="flex items-center gap-2">
    {#if showSettings}
      <a href="/pengaturan" aria-label="Pengaturan" class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12">
        <Settings size={22} />
      </a>
    {:else}
      <div class="w-[38px] h-[38px]"></div>
    {/if}
  </div>
</div>
<style>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.5s cubic-bezier(.4,1.4,.6,1);
}
</style> 