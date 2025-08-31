<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onDestroy } from 'svelte';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let pin = '1234';
  export let title = 'Masukkan PIN';
  export let subtitle = 'Masukkan PIN untuk melanjutkan';

  let pinInput = '';
  let pinError = '';
  let errorTimeout: number;

  function handlePinInput(num: number) {
    if (pinInput.length < 4) {
      pinInput += num.toString();
      
      if (pinInput.length === 4) {
        if (pinInput === pin) {
          dispatch('success', { pin: pinInput });
          show = false;
          pinInput = '';
          pinError = '';
        } else {
          pinError = 'PIN salah!';
          pinInput = '';
          if (errorTimeout) clearTimeout(errorTimeout);
          errorTimeout = setTimeout(() => {
            pinError = '';
          }, 2000) as any;
          dispatch('error', { message: 'PIN salah!' });
        }
      }
    }
  }

  function handleClose() {
    show = false;
    pinInput = '';
    pinError = '';
    dispatch('close');
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (errorTimeout) clearTimeout(errorTimeout);
  });
</script>

{#if show}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out"
    style="top: 58px; bottom: 58px; background: linear-gradient(to bottom right, #f472b6, #ec4899, #a855f7);"
  >
    <div class="w-full h-full flex flex-col items-center justify-center p-4">
      <div class="bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 max-w-sm w-full">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">{title}</h2>
          <p class="text-pink-100 text-sm">{subtitle}</p>
        </div>
        
        <!-- PIN Display -->
        <div class="flex justify-center gap-2 mb-6">
          {#each Array(4) as _, i}
            <div class="w-4 h-4 rounded-full {pinInput.length > i ? 'bg-white' : 'bg-white/30 border border-white/50'}"></div>
          {/each}
        </div>
        
        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-3 mb-4 justify-items-center">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
            <button
              type="button"
              class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
              onclick={() => handlePinInput(num)}
            >
              {num}
            </button>
          {/each}
          <div class="w-16 h-16"></div>
          <button
            type="button"
            class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
            onclick={() => handlePinInput(0)}
          >
            0
          </button>
          <div class="w-16 h-16"></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Animasi slideUp telah dihapus */
</style>