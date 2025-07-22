<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loginWithUsername } from '$lib/auth/auth';
  import { validateText, validatePasswordDemo, sanitizeInput } from '$lib/utils/validation';
  import { SecurityMiddleware } from '$lib/utils/security';
  import { DotLottieSvelte } from '@lottiefiles/dotlottie-svelte';
  import { selectedBranch } from '$lib/stores/selectedBranch';
  import { get } from 'svelte/store';

  let userRole = '';
  let username = '';
  let password = '';
  let isLoading = false;
  let errorMessage = '';
  let successMessage = '';

  // Form validation
  let usernameError = '';
  let passwordError = '';

  let branch: 'samarinda' | 'berau' = 'samarinda';
  $: selectedBranch.set(branch);

  // Validate form
  function validateForm(): boolean {
    let isValid = true;
    const usernameValidation = validateText(username, {
      required: true,
      minLength: 3,
      maxLength: 50
    });
    usernameError = usernameValidation.errors.join(', ');
    if (!usernameValidation.isValid) isValid = false;
    const passwordValidation = validatePasswordDemo(password);
    passwordError = passwordValidation.errors.join(', ');
    if (!passwordValidation.isValid) isValid = false;
    return isValid;
  }

  let showLottieSuccess = false;
  let lottieTimeout: any = null;
  let showLottieError = false;
  let lottieErrorTimeout: any = null;
  // let isLottiePlaying = false; // Hapus semua logic isLottiePlaying

  async function handleSubmit() {
    errorMessage = '';
    successMessage = '';
    if (!validateForm()) return;
    if (!SecurityMiddleware.checkFormRateLimit('login')) {
      errorMessage = 'Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit.';
      showLottieError = true;
      clearTimeout(lottieErrorTimeout);
      lottieErrorTimeout = setTimeout(() => showLottieError = false, 1200);
      return;
    }
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = sanitizeInput(password);
    if (SecurityMiddleware.detectSuspiciousActivity('login', sanitizedUsername + sanitizedPassword)) {
      errorMessage = 'Aktivitas mencurigakan terdeteksi. Silakan coba lagi.';
      SecurityMiddleware.logSecurityEvent('login_attempt_blocked', {
        username: sanitizedUsername,
        reason: 'suspicious_activity'
      });
      showLottieError = true;
      clearTimeout(lottieErrorTimeout);
      lottieErrorTimeout = setTimeout(() => showLottieError = false, 1200);
      return;
    }
    isLoading = true;
    try {
      await loginWithUsername(sanitizedUsername, sanitizedPassword, branch);
      showLottieSuccess = true;
      // isLottiePlaying = true; // Hapus semua logic isLottiePlaying
      await new Promise(resolve => setTimeout(resolve, 1200));
      // isLottiePlaying = false; // Hapus semua logic isLottiePlaying
      goto('/');
    } catch (e) {
      errorMessage = e.message;
      SecurityMiddleware.logSecurityEvent('login_failed', {
        username: sanitizedUsername,
        reason: 'invalid_credentials'
      });
      showLottieError = true;
      clearTimeout(lottieErrorTimeout);
      lottieErrorTimeout = setTimeout(() => showLottieError = false, 1200);
    } finally {
      isLoading = false;
    }
  }

  function handleUsernameChange() { usernameError = ''; }
  function handlePasswordChange() { passwordError = ''; }
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isLoading) handleSubmit();
  }

  onMount(async () => {
    if (userRole === 'kasir') {
      const { data } = await supabase.from('pengaturan_keamanan').select('locked_pages').single();
      const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
      if (lockedPages.includes('beranda')) {
        // showPinModal = true; // Hapus semua logic showPinModal
      }
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-pink-200 via-pink-100 to-pink-300 flex items-center justify-center p-4 page-content">
  <div class="w-full max-w-sm">
    <!-- Logo dan Header -->
    <div class="text-center mb-8">
      <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-500/20">
        <img src="/img/logo.svg" alt="Logo ZatiarasPOS" class="w-10 h-10 object-contain" />
      </div>
      <h1 class="text-2xl font-bold text-gray-800 mb-1">ZatiarasPOS</h1>
      <p class="text-pink-400 text-sm font-semibold">Aplikasi Kasir by Zatiaras</p>
    </div>

    <!-- Login Form -->
    <div class="bg-white/30 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-8">
      <h2 class="text-lg font-semibold text-gray-800 mb-6 text-center">Masuk ke ZatiarasPOS</h2>

      <!-- Error Message -->
      {#if errorMessage}
        <div class="bg-red-50/80 border border-red-200/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <span class="text-red-700 text-sm font-medium">{errorMessage}</span>
          </div>
        </div>
      {/if}

      <!-- Preload Lottie Animation (hidden) -->
      <div style="display:none">
        <DotLottieSvelte
          src="https://lottie.host/5f0b1da8-edb0-4f37-a685-4d45c9eca62d/h8rS33014U.lottie"
          loop
          autoplay
        />
      </div>

      <!-- Floating Lottie Success Notification -->
      {#if showLottieSuccess}
        <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div class="flex flex-col items-center bg-white/80 rounded-2xl shadow-2xl px-8 py-6 border border-pink-200 animate-fadeInUp">
            <DotLottieSvelte
              src="https://lottie.host/5f0b1da8-edb0-4f37-a685-4d45c9eca62d/h8rS33014U.lottie"
              style="width: 90px; height: 90px;"
              loop
              autoplay
            />
            <div class="mt-2 text-pink-500 font-bold text-lg">Login Berhasil!</div>
          </div>
        </div>
      {/if}

      <!-- Floating Lottie Error Notification -->
      {#if showLottieError}
        <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div class="flex flex-col items-center bg-white/80 rounded-2xl shadow-2xl px-8 py-6 border border-red-200 animate-fadeInUp">
            <div class="flex items-center justify-center w-[90px] h-[90px] rounded-full bg-red-100 mb-2">
              <svg class="w-16 h-16 text-red-500" fill="none" viewBox="0 0 64 64" stroke="currentColor" stroke-width="3">
                <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="3" fill="#fee2e2" />
                <line x1="22" y1="22" x2="42" y2="42" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                <line x1="42" y1="22" x2="22" y2="42" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
              </svg>
            </div>
            <div class="mt-2 text-red-500 font-bold text-lg">{errorMessage || 'Login Gagal!'}</div>
          </div>
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <!-- Username Field -->
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <div class="relative">
            <input
              id="username"
              type="text"
              bind:value={username}
              on:input={handleUsernameChange}
              on:keypress={handleKeyPress}
              class="block w-full rounded-xl border border-gray-200 bg-white/80 py-3 px-4 text-gray-800 shadow-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition placeholder-gray-400"
              placeholder="Masukkan username"
              autocomplete="username"
              required
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
          </div>
          {#if usernameError}
            <div class="text-xs text-red-500 mt-1">{usernameError}</div>
          {/if}
        </div>
        <!-- Password Field -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div class="relative">
            <input
              id="password"
              type="password"
              bind:value={password}
              on:input={handlePasswordChange}
              on:keypress={handleKeyPress}
              class="block w-full rounded-xl border border-gray-200 bg-white/80 py-3 px-4 text-gray-800 shadow-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition placeholder-gray-400"
              placeholder="Masukkan password"
              autocomplete="current-password"
              required
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </span>
          </div>
          {#if passwordError}
            <div class="text-xs text-red-500 mt-1">{passwordError}</div>
          {/if}
        </div>
        <!-- Submit Button -->
        <button
          type="submit"
          class="w-full bg-pink-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-pink-500/10 transition-colors duration-200 hover:bg-pink-600 active:bg-pink-700 focus:ring-2 focus:ring-pink-300 focus:outline-none flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          {#if isLoading}
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
            <span>Memproses...</span>
          {:else}
            <span>Masuk</span>
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>

<!-- Dropdown Cabang di pojok kanan bawah tanpa icon -->
<div class="fixed bottom-4 right-4 z-40">
  <div class="backdrop-blur-xl bg-white/30 border border-white/40 shadow-lg rounded-2xl px-4 py-2 flex items-center min-w-[120px] justify-end" style="box-shadow: 0 4px 24px 0 rgba(255, 182, 193, 0.12);">
    <select
      class="bg-transparent outline-none border-none text-sm font-semibold text-gray-700 px-1 py-0.5 focus:ring-0 focus:outline-none cursor-pointer"
      bind:value={branch}
      aria-label="Pilih Cabang"
    >
      <option value="samarinda">Samarinda</option>
      <option value="berau">Berau</option>
    </select>
  </div>
</div>

<style>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(32px);}
  to { opacity: 1; transform: translateY(0);}
}
.animate-fadeInUp {
  animation: fadeInUp 0.5s cubic-bezier(.4,0,.2,1);
}
</style> 