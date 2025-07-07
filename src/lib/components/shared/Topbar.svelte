<script lang="ts">
import Settings from 'lucide-svelte/icons/settings';
import { goto } from '$app/navigation';

export let showSettings: boolean = true;
export let onSettings: (() => void) | undefined;
</script>

<div class="flex items-center justify-between px-4 pt-4 pb-3 bg-white sticky top-0 z-10 nav-transition">
  <div class="flex items-center gap-3">
    <img class="w-[38px] h-[38px] rounded-lg object-cover shadow-lg shadow-pink-500/7 bg-white" src="/img/logo.svg" alt="Logo Zatiaras" />
  </div>
  <div class="flex-1 text-center text-lg font-medium text-gray-800 tracking-wide">
    <slot />
  </div>
  <slot name="actions" />
  <slot name="download" />
  <div class="flex items-center gap-2">
    {#if showSettings}
      <button class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12" aria-label="Pengaturan" onclick={onSettings ?? (() => goto('/pengaturan'))}>
        <Settings size={22} />
      </button>
    {:else}
      <div class="w-[38px] h-[38px]"></div>
    {/if}
  </div>
</div> 