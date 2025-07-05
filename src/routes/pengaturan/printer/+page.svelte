<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import Printer from 'lucide-svelte/icons/printer';
import CheckCircle from 'lucide-svelte/icons/check-circle';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';

let devices = [
  { name: 'Printer Kasir 1', id: 'A1:B2:C3:D4:E5:F6', connected: false },
  { name: 'Printer Thermal Mini', id: '11:22:33:44:55:66', connected: false },
  { name: 'Bluetooth Printer ZJ-58', id: 'AA:BB:CC:DD:EE:FF', connected: false }
];
let scanning = false;
let connectedId = '';
let scanInterval;

function scanDevices() {
  scanning = true;
  setTimeout(() => {
    scanning = false;
    // Dummy: tidak mengubah devices
  }, 800);
}

function connectDevice(id: string) {
  connectedId = id;
  devices = devices.map(d => ({ ...d, connected: d.id === id }));
}

onMount(() => {
  scanDevices();
  scanInterval = setInterval(scanDevices, 2000);
});

onDestroy(() => {
  clearInterval(scanInterval);
});
</script>

<svelte:head>
  <title>Sandingkan Printer - ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-4xl mx-auto px-4 py-4">
      <div class="flex items-center">
        <button onclick={() => history.back()} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
          <ArrowLeft class="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  </div>

  <div class="flex-1 flex flex-col items-center px-4 pt-6 pb-8">
    <div class="w-full max-w-md">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Printer class="w-6 h-6 text-blue-500" />
          <span class="font-semibold text-blue-700">Perangkat Bluetooth Tersedia</span>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        {#each devices as d}
          <div class="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 shadow flex items-center justify-between px-4 py-4 gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <Printer class="w-7 h-7 text-blue-400 flex-shrink-0" />
              <div class="min-w-0">
                <div class="font-semibold text-gray-800 truncate">{d.name}</div>
                <div class="text-xs text-gray-500 truncate">{d.id}</div>
              </div>
            </div>
            {#if d.connected}
              <span class="flex items-center gap-1 text-green-600 font-semibold text-xs bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <CheckCircle class="w-4 h-4" /> Tersambung
              </span>
            {:else}
              <button onclick={() => connectDevice(d.id)} class="px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold text-xs shadow hover:bg-pink-600 transition-colors">
                Sambungkan
              </button>
            {/if}
          </div>
        {/each}
      </div>
      <div class="text-xs text-gray-400 text-center mt-8">Pastikan printer Bluetooth Anda dalam mode pairing dan dekat dengan perangkat ini.</div>
    </div>
  </div>
</div> 