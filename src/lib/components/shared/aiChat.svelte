<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let isLoading = false;
	export let question = '';
	export let answer = '';
	export let showModal = false;

	const dispatch = createEventDispatcher();

	function handleSubmit() {
		if (question.trim()) {
			dispatch('ask', { question: question.trim() });
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}

	function closeModal() {
		showModal = false;
		question = '';
		answer = '';
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

<!-- AI Chat Input Section -->
<div class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-4 shadow-lg">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center gap-3">
			<!-- AI Icon -->
			<div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
				<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
					<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
			</div>
			
			<!-- Input Container -->
			<div class="flex-1 relative">
				<input
					type="text"
					placeholder="Tanya AI tentang laporan ini..."
					bind:value={question}
					onkeypress={handleKeyPress}
					disabled={isLoading}
					class="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
				/>
				
				<!-- Send Button -->
				<button
					onclick={handleSubmit}
					disabled={!question.trim() || isLoading}
					class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
				>
					{#if isLoading}
						<svg class="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
		
		<!-- Helper Text -->
		<p class="text-xs text-gray-500 mt-2 text-center">
			💡 Tanya tentang pendapatan, pengeluaran, tren penjualan, atau analisis laporan
		</p>
	</div>
</div>

<!-- AI Response Modal -->
{#if showModal}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div 
			class="w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
			transition:slide={{ duration: 300, easing: cubicOut }}
		>
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
							<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
						<h3 class="text-lg font-bold text-white">AI Assistant</h3>
					</div>
					<button
						onclick={closeModal}
						class="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
						aria-label="Tutup"
					>
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
			
			<!-- Modal Content -->
			<div class="p-6 overflow-y-auto max-h-[60vh]">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="flex items-center gap-3">
							<svg class="w-6 h-6 text-pink-500 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span class="text-gray-600 font-medium">AI sedang memproses pertanyaan Anda...</span>
						</div>
					</div>
				{:else if answer}
					<div class="prose prose-sm max-w-none">
						<div class="bg-gray-50 rounded-xl p-4 mb-4">
							<p class="text-sm text-gray-600 mb-0">
								<strong>Pertanyaan:</strong> {question}
							</p>
						</div>
						<div class="text-gray-800 leading-relaxed whitespace-pre-wrap">
							{answer}
						</div>
					</div>
				{/if}
			</div>
			
			<!-- Modal Footer -->
			<div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
				<div class="flex items-center justify-between">
					<p class="text-xs text-gray-500">
						Powered by DeepSeek AI
					</p>
					<button
						onclick={closeModal}
						class="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium transition-colors"
					>
						Tutup
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom scrollbar for modal content */
	.prose::-webkit-scrollbar {
		width: 4px;
	}
	
	.prose::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 2px;
	}
	
	.prose::-webkit-scrollbar-thumb {
		background: #e91e63;
		border-radius: 2px;
	}
	
	.prose::-webkit-scrollbar-thumb:hover {
		background: #c2185b;
	}
</style>
