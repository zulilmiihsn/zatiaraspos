<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onDestroy } from 'svelte';

  const dispatch = createEventDispatcher();

  export let show: boolean = false;
  export let message: string = '';
  export let type: 'success' | 'error' | 'warning' | 'info' = 'success';
  export let duration: number = 2000; // Default 2 seconds
  export let position: 'top' | 'bottom' = 'top';

  let timeoutId: number | undefined; // Menggunakan number | undefined untuk setTimeout

  // Refactor color logic using reactive declarations
  $: bgColorClass = {
    'success': 'bg-green-500',
    'error': 'bg-red-500',
    'warning': 'bg-yellow-500',
    'info': 'bg-blue-500',
  }[type] || 'bg-green-500'; // Default to green

  $: borderColorClass = {
    'success': 'border-green-400',
    'error': 'border-red-400',
    'warning': 'border-yellow-400',
    'info': 'border-blue-400',
  }[type] || 'border-green-400'; // Default to green

  // Auto dismiss functionality
  $: if (show && duration > 0) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      show = false;
      dispatch('dismiss');
    }, duration);
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
</script>

{#if show}
  <div 
    class="fixed left-1/2 z-50 px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out text-white font-semibold text-center min-w-[200px] max-w-[90vw] flex items-center justify-center gap-2 {bgColorClass} border {borderColorClass} toast-position-{position}"
    style="transform: translateX(-50%);"
    in:fly={{ y: position === 'top' ? -32 : 32, duration: 300, easing: cubicOut }}
    out:fade={{ duration: 200 }}
  >
    <span class="flex-shrink-0">
      {#if type === 'success'}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      {:else if type === 'error'}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      {:else if type === 'warning'}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
      {:else if type === 'info'}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      {/if}
    </span>
    <span class="flex-1">{message}</span>
  </div>
{/if}

<style>
  .toast-position-top {
    top: 20px;
  }
  .toast-position-bottom {
    bottom: 20px;
  }
</style>