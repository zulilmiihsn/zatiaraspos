<script lang="ts">
import Settings from 'lucide-svelte/icons/settings';
import { goto } from '$app/navigation';
import { transaksiPendingCount } from '$lib/stores/transaksiPendingCount';
import { onDestroy } from 'svelte';
import { get } from 'svelte/store';

export let showSettings: boolean = true;

let pendingCount = 0;
let showPopover = false;
const unsubscribe = transaksiPendingCount.subscribe(val => pendingCount = val);
onDestroy(unsubscribe);
</script>

<div class="flex items-center justify-between px-4 pt-4 pb-3 bg-white z-10 nav-transition">
  <div class="flex items-center gap-3">
    <img class="w-[38px] h-[38px] p-1.5 rounded-lg object-contain shadow-lg shadow-pink-500/7 bg-white" src="/img/logo.svg" alt="Logo Zatiaras" />
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
      <a href="/pengaturan" sveltekit:prefetch aria-label="Pengaturan" class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12">
        <Settings size={22} />
      </a>
    {:else}
      <div class="w-[38px] h-[38px]"></div>
    {/if}
  </div>
</div> 