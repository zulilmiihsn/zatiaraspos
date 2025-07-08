<script lang="ts">
import { onMount, onDestroy } from 'svelte';

// Lazy load icons
let Printer, CheckCircle, ArrowLeft, Bluetooth, RefreshCw, AlertCircle, Wifi, WifiOff;
onMount(async () => {
  const icons = await Promise.all([
    import('lucide-svelte/icons/printer'),
    import('lucide-svelte/icons/check-circle'),
    import('lucide-svelte/icons/arrow-left'),
    import('lucide-svelte/icons/bluetooth'),
    import('lucide-svelte/icons/refresh-cw'),
    import('lucide-svelte/icons/alert-circle'),
    import('lucide-svelte/icons/wifi'),
    import('lucide-svelte/icons/wifi-off')
  ]);
  Printer = icons[0].default;
  CheckCircle = icons[1].default;
  ArrowLeft = icons[2].default;
  Bluetooth = icons[3].default;
  RefreshCw = icons[4].default;
  AlertCircle = icons[5].default;
  Wifi = icons[6].default;
  WifiOff = icons[7].default;
});

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  rssi?: number;
  lastSeen: Date;
}

let devices: BluetoothDevice[] = [];
let scanning = false;
let connectedDevice: BluetoothDevice | null = null;
let bluetoothSupported = false;
let bluetoothEnabled = false;
let errorMessage = '';
let scanInterval: number;

// Check Bluetooth support
onMount(() => {
  bluetoothSupported = 'bluetooth' in navigator;
  if (bluetoothSupported) {
    checkBluetoothAvailability();
  }
});

async function checkBluetoothAvailability() {
  try {
    bluetoothEnabled = await navigator.bluetooth.getAvailability();
  } catch (error) {
    console.error('Bluetooth availability check failed:', error);
    bluetoothEnabled = false;
  }
}

async function scanDevices() {
  if (!bluetoothSupported || !bluetoothEnabled) {
    errorMessage = 'Bluetooth tidak didukung atau tidak tersedia di perangkat ini';
    return;
  }

  if (scanning) return;

  try {
    scanning = true;
    errorMessage = '';

    // Request Bluetooth device with printer service
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access', 'device_information']
    });

    // Add device to list if not already present
    const existingDevice = devices.find(d => d.id === device.id);
    if (!existingDevice) {
      const newDevice: BluetoothDevice = {
        id: device.id,
        name: device.name || `Perangkat ${device.id.slice(-6)}`,
        connected: false,
        lastSeen: new Date()
      };
      devices = [...devices, newDevice];
    } else {
      // Update existing device
      devices = devices.map(d => 
        d.id === device.id 
          ? { ...d, lastSeen: new Date() }
          : d
      );
    }

  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      errorMessage = 'Tidak ada perangkat Bluetooth ditemukan';
    } else if (error.name === 'NotAllowedError') {
      errorMessage = 'Izin Bluetooth ditolak';
    } else if (error.name === 'UserCancelledError') {
      // User cancelled, no error message needed
    } else {
      errorMessage = 'Gagal memindai perangkat: ' + error.message;
    }
  } finally {
    scanning = false;
  }
}

async function connectDevice(device: BluetoothDevice) {
  try {
    errorMessage = '';
    
    // Request device connection
    const bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access', 'device_information']
    });

    // Connect to GATT server
    const server = await bluetoothDevice.gatt?.connect();
    
    if (server) {
      // Update device status
      devices = devices.map(d => ({
        ...d,
        connected: d.id === device.id
      }));
      
      connectedDevice = {
        ...device,
        connected: true
      };

      // Store connected device info
      localStorage.setItem('connectedPrinter', JSON.stringify({
        id: device.id,
        name: device.name,
        connectedAt: new Date().toISOString()
      }));

      errorMessage = '';
    }
  } catch (error: any) {
    errorMessage = 'Gagal menyambungkan: ' + error.message;
    console.error('Connection error:', error);
  }
}

async function disconnectDevice() {
  try {
    if (connectedDevice) {
      // Update device status
      devices = devices.map(d => ({
        ...d,
        connected: false
      }));
      
      connectedDevice = null;
      
      // Remove from localStorage
      localStorage.removeItem('connectedPrinter');
      
      errorMessage = '';
    }
  } catch (error: any) {
    errorMessage = 'Gagal memutuskan sambungan: ' + error.message;
  }
}

function refreshDevices() {
  devices = [];
  errorMessage = '';
  scanDevices();
}

// Load previously connected device
onMount(() => {
  const savedPrinter = localStorage.getItem('connectedPrinter');
  if (savedPrinter) {
    try {
      const printerData = JSON.parse(savedPrinter);
      connectedDevice = {
        id: printerData.id,
        name: printerData.name,
        connected: true,
        lastSeen: new Date()
      };
      
      // Add to devices list
      devices = [connectedDevice];
    } catch (error) {
      console.error('Failed to load saved printer:', error);
    }
  }
});

onDestroy(() => {
  if (scanInterval) {
    clearInterval(scanInterval);
  }
});
</script>

<svelte:head>
  <title>Pengaturan Printer - ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 page-content">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-4xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          {#if ArrowLeft}
            <button onclick={() => history.back()} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
              <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
            </button>
          {:else}
            <div class="w-5 h-5 flex items-center justify-center">
              <span class="block w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></span>
            </div>
          {/if}
          <div class="flex items-center gap-2">
            {#if Printer}
              <svelte:component this={Printer} class="w-6 h-6 text-pink-500" />
            {:else}
              <div class="w-6 h-6 flex items-center justify-center">
                <span class="block w-5 h-5 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <h1 class="text-lg font-semibold text-gray-800">Pengaturan Printer</h1>
          </div>
        </div>
        
        <button 
          onclick={refreshDevices}
          disabled={scanning}
          class="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 disabled:opacity-50 transition-colors"
        >
          {#if RefreshCw}
            <svelte:component this={RefreshCw} class={`w-5 h-5 text-pink-600${scanning ? ' animate-spin' : ''}`} />
          {:else}
            <div class="w-5 h-5 flex items-center justify-center">
              <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></span>
            </div>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <div class="flex-1 flex flex-col px-4 pt-6 pb-8">
    <div class="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
      
      <!-- Bluetooth Status -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 md:p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            {#if bluetoothSupported && bluetoothEnabled}
              {#if Wifi}
                <svelte:component this={Wifi} class="w-6 h-6 text-green-500" />
              {:else}
                <div class="w-6 h-6 flex items-center justify-center">
                  <span class="block w-5 h-5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin"></span>
                </div>
              {/if}
              <div>
                <div class="font-semibold text-gray-800">Bluetooth Aktif</div>
                <div class="text-sm text-gray-500">Siap untuk memindai perangkat</div>
              </div>
            {:else}
              {#if WifiOff}
                <svelte:component this={WifiOff} class="w-6 h-6 text-red-500" />
              {:else}
                <div class="w-6 h-6 flex items-center justify-center">
                  <span class="block w-5 h-5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin"></span>
                </div>
              {/if}
              <div>
                <div class="font-semibold text-gray-800">Bluetooth Tidak Tersedia</div>
                <div class="text-sm text-gray-500">
                  {bluetoothSupported ? 'Aktifkan Bluetooth di pengaturan' : 'Perangkat tidak mendukung Bluetooth'}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Connected Device -->
      {#if connectedDevice}
        <div class="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border border-pink-200 shadow-sm p-4 mb-6 md:p-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              {#if CheckCircle}
                <svelte:component this={CheckCircle} class="w-6 h-6 text-green-500" />
              {:else}
                <div class="w-6 h-6 flex items-center justify-center">
                  <span class="block w-5 h-5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin"></span>
                </div>
              {/if}
              <div>
                <div class="font-semibold text-gray-800">{connectedDevice.name}</div>
                <div class="text-sm text-gray-500">ID: {connectedDevice.id}</div>
              </div>
            </div>
            <button 
              onclick={disconnectDevice}
              class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
            >
              Putuskan
            </button>
          </div>
        </div>
      {/if}

      <!-- Error Message -->
      {#if errorMessage}
        <div class="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 md:p-6">
          <div class="flex items-center gap-3">
            {#if AlertCircle}
              <svelte:component this={AlertCircle} class="w-5 h-5 text-red-500 flex-shrink-0" />
            {:else}
              <div class="w-5 h-5 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm text-red-700">{errorMessage}</div>
          </div>
        </div>
      {/if}

      <!-- Scan Button -->
      {#if bluetoothSupported && bluetoothEnabled && !connectedDevice}
        <div class="mb-6 md:mb-8">
          <button 
            onclick={scanDevices}
            disabled={scanning}
            class="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-semibold py-4 px-6 rounded-2xl shadow-sm transition-colors flex items-center justify-center gap-3 md:py-5 md:text-lg"
          >
            {#if scanning}
              {#if RefreshCw}
                <svelte:component this={RefreshCw} class="w-5 h-5 animate-spin" />
              {:else}
                <div class="w-5 h-5 flex items-center justify-center">
                  <span class="block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              {/if}
              <span>Memindai...</span>
            {:else}
              {#if Bluetooth}
                <svelte:component this={Bluetooth} class="w-5 h-5" />
              {:else}
                <div class="w-5 h-5 flex items-center justify-center">
                  <span class="block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              {/if}
              <span>Pindai Perangkat Bluetooth</span>
            {/if}
          </button>
        </div>
      {/if}

      <!-- Device List -->
      {#if devices.length > 0}
        <div class="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
          <h2 class="font-semibold text-gray-800 mb-3 md:col-span-2 lg:col-span-3">Perangkat Tersedia</h2>
          {#each devices as device}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  {#if device.connected}
                    {#if CheckCircle}
                      <svelte:component this={CheckCircle} class="w-6 h-6 text-green-500 flex-shrink-0" />
                    {:else}
                      <div class="w-6 h-6 flex items-center justify-center">
                        <span class="block w-5 h-5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin"></span>
                      </div>
                    {/if}
                  {:else}
                    {#if Bluetooth}
                      <svelte:component this={Bluetooth} class="w-6 h-6 text-gray-400 flex-shrink-0" />
                    {:else}
                      <div class="w-6 h-6 flex items-center justify-center">
                        <span class="block w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin"></span>
                      </div>
                    {/if}
                  {/if}
                  
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-gray-800 truncate">{device.name}</div>
                    <div class="text-sm text-gray-500 truncate">ID: {device.id}</div>
                    <div class="text-xs text-gray-400">
                      Terakhir terlihat: {device.lastSeen.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <div class="flex justify-end">
                  {#if device.connected}
                    <span class="text-green-600 font-semibold text-sm bg-green-50 border border-green-200 rounded-full px-3 py-1">
                      Tersambung
                    </span>
                  {:else if bluetoothSupported && bluetoothEnabled}
                    <button 
                      onclick={() => connectDevice(device)}
                      class="px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold text-sm shadow-sm hover:bg-pink-600 transition-colors"
                    >
                      Sambungkan
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if bluetoothSupported && bluetoothEnabled}
        <div class="text-center py-12 md:py-16">
          <div class="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {#if Bluetooth}
              <svelte:component this={Bluetooth} class="w-8 h-8 md:w-10 md:h-10 text-gray-400" />
            {:else}
              <div class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
                <span class="block w-6 h-6 md:w-8 md:h-8 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin"></span>
              </div>
            {/if}
          </div>
          <h3 class="font-semibold text-gray-800 mb-2 md:text-lg">Belum Ada Perangkat</h3>
          <p class="text-gray-500 text-sm md:text-base">Tekan tombol "Pindai Perangkat Bluetooth" untuk mencari printer di sekitar</p>
        </div>
      {/if}

      <!-- Help Text -->
      <div class="text-center mt-8 md:mt-12">
        <div class="text-xs text-gray-400 space-y-1 md:text-sm">
          <p>• Pastikan printer Bluetooth dalam mode pairing</p>
          <p>• Perangkat harus berada dalam jarak dekat</p>
          <p>• Izinkan akses Bluetooth saat diminta</p>
        </div>
      </div>
    </div>
  </div>
</div> 