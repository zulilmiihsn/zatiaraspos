<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth/auth';
  import { SecurityMiddleware } from '$lib/utils/security';

  // Log unauthorized access attempt
  SecurityMiddleware.logSecurityEvent('unauthorized_access', {
    user: auth.getCurrentUser()?.username || 'anonymous',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  });

  function goBack() {
    goto('/pengaturan');
  }

  function goToLogin() {
    auth.logout();
    goto('/login');
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4 page-content">
  <div class="w-full max-w-md text-center">
    <!-- Icon -->
    <div class="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    </div>

    <!-- Content -->
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-4">Akses Ditolak</h1>
      
      <p class="text-gray-600 mb-6">
        Maaf, Anda tidak memiliki izin untuk mengakses halaman ini. 
        Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
      </p>

      <!-- Action Buttons -->
      <div class="space-y-3">
        <button
          onclick={goBack}
          class="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
        >
          Kembali
        </button>
        
        <button
          onclick={goToLogin}
          class="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Login Ulang
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-6">
      <p class="text-sm text-gray-500">
        © 2024 Zatiaras Juice. All rights reserved.
      </p>
    </div>
  </div>
</div> 