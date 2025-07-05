<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth, session } from '$lib/auth.js';
  import { validateText, validatePasswordDemo, sanitizeInput } from '$lib/validation.js';
  import { SecurityMiddleware } from '$lib/security.js';

  let username = '';
  let password = '';
  let isLoading = false;
  let errorMessage = '';
  let successMessage = '';

  // Form validation
  let usernameError = '';
  let passwordError = '';

  // Check if already logged in
  onMount(() => {
    if (auth.isAuthenticated()) {
      goto('/');
    }
  });

  // Validate form
  function validateForm(): boolean {
    let isValid = true;

    // Validate username
    const usernameValidation = validateText(username, {
      required: true,
      minLength: 3,
      maxLength: 50
    });
    usernameError = usernameValidation.errors.join(', ');
    if (!usernameValidation.isValid) isValid = false;

    // Validate password (simplified for demo)
    const passwordValidation = validatePasswordDemo(password);
    passwordError = passwordValidation.errors.join(', ');
    if (!passwordValidation.isValid) isValid = false;

    return isValid;
  }

  // Handle form submission
  async function handleSubmit() {
    // Clear previous messages
    errorMessage = '';
    successMessage = '';

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Check rate limiting
    if (!SecurityMiddleware.checkFormRateLimit('login')) {
      errorMessage = 'Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit.';
      return;
    }

    // Sanitize inputs
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = sanitizeInput(password);

    // Check for suspicious activity
    if (SecurityMiddleware.detectSuspiciousActivity('login', sanitizedUsername + sanitizedPassword)) {
      errorMessage = 'Aktivitas mencurigakan terdeteksi. Silakan coba lagi.';
      SecurityMiddleware.logSecurityEvent('login_attempt_blocked', {
        username: sanitizedUsername,
        reason: 'suspicious_activity'
      });
      return;
    }

    isLoading = true;

    try {
      const result = await auth.login(sanitizedUsername, sanitizedPassword);
      
      if (result.success) {
        const userRole = result.user?.role;
        const userName = result.user?.name;
        
        // Custom success message based on role
        let roleMessage = '';
        if (userRole === 'admin') {
          roleMessage = 'Selamat datang, Administrator! Anda memiliki akses penuh ke semua fitur sistem.';
        } else if (userRole === 'kasir') {
          roleMessage = 'Selamat datang, Kasir! Anda dapat mengakses POS dan laporan transaksi.';
        }
        
        successMessage = `${result.message} ${roleMessage}`;
        
        SecurityMiddleware.logSecurityEvent('login_success', {
          username: sanitizedUsername,
          role: userRole,
          name: userName
        });
        
        // Redirect after short delay
        setTimeout(() => {
          goto('/');
        }, 2000); // Increased delay to show role message
      } else {
        errorMessage = result.message;
        SecurityMiddleware.logSecurityEvent('login_failed', {
          username: sanitizedUsername,
          reason: 'invalid_credentials'
        });
      }
    } catch (error) {
      errorMessage = 'Terjadi kesalahan sistem. Silakan coba lagi.';
      SecurityMiddleware.logSecurityEvent('login_error', {
        username: sanitizedUsername,
        error: error.message
      });
    } finally {
      isLoading = false;
    }
  }

  // Handle input changes
  function handleUsernameChange() {
    usernameError = '';
  }

  function handlePasswordChange() {
    passwordError = '';
  }

  // Handle key press
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

<svelte:head>
  <title>Login - ZatiarasPOS</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-pink-200 via-pink-100 to-pink-300 flex items-center justify-center p-4">
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

      <!-- Success Message -->
      {#if successMessage}
        <div class="bg-green-50/80 border border-green-200/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <span class="text-green-700 text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      {/if}

      <form onsubmit|preventDefault={handleSubmit} class="space-y-5">
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
                              oninput={handleUsernameChange}
                onkeypress={handleKeyPress}
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
                              oninput={handlePasswordChange}
                onkeypress={handleKeyPress}
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