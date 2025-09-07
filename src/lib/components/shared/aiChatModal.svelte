<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { AiChatMessage, TransactionAnalysis, AiRecommendation } from '$lib/types/ai';
  import { AiAnalysisService } from '$lib/services/aiAnalysisService';
  import { AutoApplyService } from '$lib/services/autoApplyService';

  export let isOpen = false;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();
  
  let messages: AiChatMessage[] = [];
  let currentMessage = '';
  let isLoading = false;
  let currentAnalysis: TransactionAnalysis | null = null;
  let showRecommendations = false;

  const aiAnalysisService = AiAnalysisService.getInstance();
  const autoApplyService = AutoApplyService.getInstance();

  onMount(() => {
    if (isOpen) {
      addWelcomeMessage();
    }
  });

  // Reactive statement untuk mengontrol body scroll
  $: if (isOpen && typeof document !== 'undefined') {
    document.body.classList.add('modal-open');
  } else if (typeof document !== 'undefined') {
    document.body.classList.remove('modal-open');
  }

  function addWelcomeMessage() {
    const welcomeMessage: AiChatMessage = {
      id: `msg_${Date.now()}`,
      content: "Halo! Saya Asisten AI untuk membantu Anda mengelola transaksi. Ceritakan transaksi yang ingin Anda catat, misalnya: 'Tadi masukkan uang 2000, ambil 5000 buat beli jajan'",
      role: 'assistant',
      timestamp: new Date()
    };
    messages = [welcomeMessage];
  }

  async function sendMessage() {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `msg_${Date.now()}`,
      content: currentMessage.trim(),
      role: 'user',
      timestamp: new Date()
    };

    messages = [...messages, userMessage];
    const messageText = currentMessage.trim();
    currentMessage = '';
    isLoading = true;

    try {
      // Analisis transaksi
      const analysis = await aiAnalysisService.analyzeTransaction(messageText);
      currentAnalysis = analysis;

      // Generate response
      const responseText = aiAnalysisService.generateResponseText(analysis);
      
      const aiMessage: AiChatMessage = {
        id: `msg_${Date.now()}`,
        content: responseText,
        role: 'assistant',
        timestamp: new Date()
      };

      messages = [...messages, aiMessage];
      
      // Tampilkan rekomendasi jika ada
      if (analysis.recommendations.length > 0) {
        showRecommendations = true;
      }

    } catch (error) {
      const errorMessage: AiChatMessage = {
        id: `msg_${Date.now()}`,
        content: "Maaf, terjadi kesalahan saat menganalisis pesan Anda. Silakan coba lagi.",
        role: 'assistant',
        timestamp: new Date()
      };
      messages = [...messages, errorMessage];
    } finally {
      isLoading = false;
    }
  }

  async function applyRecommendations() {
    if (!currentAnalysis || !currentAnalysis.recommendations.length) return;

    isLoading = true;
    showRecommendations = false;

    try {
      const result = await autoApplyService.applyRecommendations(currentAnalysis.recommendations);
      
      const resultMessage: AiChatMessage = {
        id: `msg_${Date.now()}`,
        content: result.success 
          ? `✅ ${result.message}` 
          : `❌ ${result.message}`,
        role: 'assistant',
        timestamp: new Date()
      };

      messages = [...messages, resultMessage];
      currentAnalysis = null;
      showRecommendations = false;

      // Dispatch event untuk refresh data di parent
      dispatch('recommendationsApplied', { result });

    } catch (error) {
      const errorMessage: AiChatMessage = {
        id: `msg_${Date.now()}`,
        content: "Maaf, terjadi kesalahan saat menerapkan rekomendasi. Silakan coba lagi.",
        role: 'assistant',
        timestamp: new Date()
      };
      messages = [...messages, errorMessage];
    } finally {
      isLoading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function closeModal() {
    // Reset chat state saat modal ditutup
    messages = [];
    currentAnalysis = null;
    showRecommendations = false;
    currentMessage = '';
    isLoading = false;
    onClose();
  }
</script>

{#if isOpen}
  <div class="modal-overlay fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" 
       on:click={closeModal}
       on:keydown={(e) => e.key === 'Escape' && closeModal()}
       role="dialog"
       aria-modal="true"
       tabindex="-1">
    
    <div class="modal-slideup bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col mx-4"
         on:click|stopPropagation
         role="document"
         tabindex="-1">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-rose-50 rounded-t-xl">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Asisten AI</h3>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            on:click={closeModal}
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            aria-label="Tutup modal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#each messages as message (message.id)}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg {
              message.role === 'user' 
                ? 'bg-pink-500 text-white' 
                : 'bg-gray-100 text-gray-900'
            }">
              <p class="text-sm whitespace-pre-wrap">{message.content}</p>
              <p class="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString('id-ID')}
              </p>
            </div>
          </div>
        {/each}

        {#if isLoading}
          <div class="flex justify-start">
            <div class="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500"></div>
                <span class="text-sm">Menganalisis...</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Recommendations -->
      {#if showRecommendations && currentAnalysis?.recommendations && currentAnalysis.recommendations.length > 0}
        <div class="border-t border-gray-200 p-4 bg-gradient-to-r from-pink-50 to-rose-50">
          <h4 class="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Rekomendasi:
          </h4>
          <div class="space-y-3">
            {#each currentAnalysis.recommendations as rec (rec.id)}
              <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900">{rec.title}</p>
                  <p class="text-xs text-gray-600 mt-1">{rec.description}</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="px-3 py-1 text-xs rounded-full font-medium {
                    rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-pink-100 text-pink-800'
                  }">
                    {rec.priority}
                  </span>
                </div>
              </div>
            {/each}
          </div>
          {#if currentAnalysis?.recommendations && currentAnalysis.recommendations.length > 0}
            <div class="flex space-x-3 mt-4">
              <button 
                on:click={applyRecommendations}
                disabled={isLoading}
                class="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl">
                {isLoading ? 'Menerapkan...' : 'Terapkan Rekomendasi'}
              </button>
              <button 
                on:click={() => showRecommendations = false}
                class="px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200">
                Batal
              </button>
            </div>
          {:else}
            <div class="mt-4">
              <button 
                on:click={() => showRecommendations = false}
                class="w-full px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200">
                Tutup
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Input -->
      <div class="border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl">
        <div class="flex space-x-3">
          <textarea
            bind:value={currentMessage}
            on:keydown={handleKeyPress}
            placeholder="Ceritakan transaksi Anda..."
            disabled={isLoading}
            class="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            rows="2">
          </textarea>
          <button
            on:click={sendMessage}
            disabled={!currentMessage.trim() || isLoading}
            class="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl text-sm font-medium hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            aria-label="Kirim pesan">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    /* Menggunakan background yang sama dengan modal buka/tutup toko */
    background: rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 99999 !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden;
    transition: background 0.2s;
    /* Memastikan modal overlay tidak ter-blur */
    filter: none !important;
    -webkit-filter: none !important;
  }
  
  /* Animasi slideUp yang sama dengan modal buka/tutup toko */
  .modal-slideup {
    animation: modalSlideUp 0.28s cubic-bezier(0.4, 1.4, 0.6, 1);
    position: relative;
    z-index: 100000 !important;
    /* Memastikan modal AI tidak ter-blur */
    filter: none !important;
    -webkit-filter: none !important;
  }
  
  @keyframes modalSlideUp {
    from {
      transform: translateY(64px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  /* Fallback untuk browser lama */
  @supports not (backdrop-filter: blur(8px)) {
    .modal-overlay {
      background: rgba(0, 0, 0, 0.4);
    }
  }
  
  /* Memastikan body tidak scroll saat modal terbuka */
  :global(body.modal-open) {
    overflow: hidden;
  }
  
  /* Memastikan bottomNav ter-blur saat modal terbuka */
  :global(body.modal-open .nav-transition) {
    filter: blur(8px);
    -webkit-filter: blur(8px);
  }
</style>
