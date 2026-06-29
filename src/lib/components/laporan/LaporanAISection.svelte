<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
	import { getApiErrorMessage, reportApiFailure } from '$lib/utils/errorHandling';
	import { fetchWithCsrfRetry } from '$lib/utils/csrf';
	import SendIcon from '$lib/components/shared/sendIcon.svelte';

	let aiQuestion = $state('');
	let showAiModal = $state(false);
	let isAiLoading = $state(false);
	let aiAnswer = $state('');

	// Renderer Markdown sederhana agar output rapi
	function renderMarkdown(md: string): string {
		if (!md) return '';
		// Escape HTML terlebih dulu
		const escapeHtml = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		let text = escapeHtml(md.trim());

		// Heading markdown (###, ##, #) -> heading kecil
		text = text.replace(/^(?:\s*)###\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');
		text = text.replace(/^(?:\s*)##\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');
		text = text.replace(/^(?:\s*)#\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');

		// Bold **teks**
		text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		// Italic *teks*
		text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
		// Garis miring _teks_
		text = text.replace(/_(.*?)_/g, '<em>$1</em>');
		// Heading sederhana: **Ringkasan Utama:** sudah dibold, jadikan h4 jika berada di awal baris
		text = text.replace(
			/(^|\n)\s*<strong>([^<]+)<\/strong>\s*:?\s*(?=\n|$)/g,
			'$1<h4 class="text-gray-900 font-semibold">$2</h4>'
		);

		// List: baris yang diawali "- " menjadi <li>
		const lines = text.split(/\n/);
		let html = '';
		let inList = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (/^-\s+/.test(trimmed)) {
				if (!inList) {
					html += '<ul class="list-disc pl-5 space-y-1">';
					inList = true;
				}
				html += `<li>${trimmed.replace(/^-\s+/, '')}</li>`;
			} else if (trimmed.length === 0) {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				html += '<br/>';
			} else {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				html += `<p>${trimmed}</p>`;
			}
		}
		if (inList) html += '</ul>';
		return html;
	}

	async function handleAiAsk(question: string) {
		aiQuestion = question;
		showAiModal = true;
		isAiLoading = true;
		aiAnswer = '';

		try {
			const response = await fetchWithCsrfRetry('/api/aichat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					question: question,
					branch: selectedBranch.value
				})
			});

			const result = await response.json();

			if (result.success) {
				aiAnswer = result.answer;
			} else {
				reportApiFailure(result, response.status, '/api/aichat');
				aiAnswer = `Error: ${getApiErrorMessage(result, response.status, 'Terjadi kesalahan saat memproses pertanyaan.')}`;
			}
		} catch (error) {
			aiAnswer =
				'Maaf, terjadi kesalahan saat menghubungi Asisten AI. Pastikan API key sudah dikonfigurasi dengan benar di file .env. Silakan coba lagi nanti.';
		} finally {
			isAiLoading = false;
		}
	}

	function handleAiClose() {
		showAiModal = false;
		aiQuestion = '';
		aiAnswer = '';
		isAiLoading = false;
	}
</script>

<div class="mt-4 px-2 md:mt-8 md:px-0">
	<div
		class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 p-8 shadow-2xl"
	>
		<!-- Background Pattern -->
		<div class="absolute inset-0 opacity-10">
			<svg class="h-full w-full" viewBox="0 0 100 100" fill="currentColor">
				<defs>
					<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
						<path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" stroke-width="0.5" />
					</pattern>
				</defs>
				<rect width="100" height="100" fill="url(#grid)" />
			</svg>
		</div>

		<!-- Floating Elements -->
		<div class="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
		<div class="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-pink-300/20 blur-2xl"></div>

		<!-- Content -->
		<div class="relative z-10">
			<!-- Header -->
			<div class="mb-6 flex items-center gap-4">
				<div class="relative">
					<div
						class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm"
					>
						<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
							/>
						</svg>
					</div>
				</div>
				<div class="flex-1">
					<h3 class="mb-1 text-2xl font-bold text-white">Asisten AI</h3>
					<p class="text-sm text-pink-100">
						Dapatkan insight cerdas dan analisis mendalam tentang laporan keuangan Anda
					</p>
				</div>
			</div>

			<!-- Input Section -->
			<div class="relative">
				<div class="flex items-center gap-3">
					<div class="relative flex-1">
						<input
							type="text"
							placeholder="Tanya AI tentang laporan ini... (contoh: 'Bagaimana performa penjualan hari ini?')"
							bind:value={aiQuestion}
							onkeypress={(e) => e.key === 'Enter' && !isAiLoading && handleAiAsk(aiQuestion)}
							disabled={isAiLoading}
							class="w-full rounded-2xl border-0 bg-white/90 px-6 py-4 pr-16 text-gray-800 placeholder-gray-500 shadow-lg backdrop-blur-sm transition-all duration-300 focus:bg-white focus:ring-4 focus:ring-white/30 focus:outline-none disabled:cursor-not-allowed disabled:bg-white/70"
						/>

						<!-- Send Button -->
						<button
							onclick={() => !isAiLoading && handleAiAsk(aiQuestion)}
							disabled={!aiQuestion.trim() || isAiLoading}
							class="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg transition-all duration-300 hover:from-pink-600 hover:to-purple-700 hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none"
						>
							{#if isAiLoading}
								<svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							{:else}
								<SendIcon class="h-5 w-5 text-white" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Quick Suggestions -->
				<div class="mt-4 flex flex-wrap gap-2">
					<button
						onclick={() => (aiQuestion = 'Bagaimana performa penjualan hari ini?')}
						class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
					>
						📊 Performa Penjualan
					</button>
					<button
						onclick={() => (aiQuestion = 'Produk apa yang paling laris?')}
						class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
					>
						🏆 Produk Terlaris
					</button>
					<button
						onclick={() => (aiQuestion = 'Berapa keuntungan bersih hari ini?')}
						class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
					>
						💰 Keuntungan Bersih
					</button>
					<button
						onclick={() => (aiQuestion = 'Bagaimana tren penjualan minggu ini?')}
						class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
					>
						📈 Tren Penjualan
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- AI Response Modal -->
{#if showAiModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4"
		onclick={(e) => e.target === e.currentTarget && handleAiClose()}
		onkeydown={(e) => e.key === 'Escape' && handleAiClose()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="mx-auto max-h-[80vh] w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-2xl md:max-w-[720px]"
			transition:slide={{ duration: 300, easing: cubicOut }}
		>
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<h3 class="text-lg font-bold text-white">Asisten AI</h3>
					</div>
					<button
						onclick={handleAiClose}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
						aria-label="Tutup"
					>
						<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Content -->
			<div class="max-h-[60vh] overflow-y-auto p-3 md:p-4">
				{#if isAiLoading}
					<div class="flex items-center justify-center px-4 py-8">
						<div class="flex flex-col items-center gap-3 text-center">
							<svg class="h-8 w-8 animate-spin text-pink-500" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span class="mx-auto max-w-xs text-sm font-medium text-gray-600 md:text-base"
								>AI sedang menganalisis data laporan Anda. Mohon tunggu sebentar...</span
							>
						</div>
					</div>
				{:else if aiAnswer}
					<div class="prose prose-sm prose-pink md:prose-base max-w-none">
						<div
							class="mb-4 rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-purple-50 p-4"
						>
							<div class="flex items-center gap-2 font-semibold text-gray-700">
								<svg
									class="h-5 w-5 text-pink-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
									/>
								</svg>
								Pertanyaan Anda:
							</div>
							<p class="mt-1 text-gray-800">{aiQuestion}</p>
						</div>
						<div
							class="rounded-xl border border-gray-100 bg-white p-4 leading-relaxed whitespace-pre-wrap text-gray-700 shadow-sm"
						>
							{@html renderMarkdown(aiAnswer)}
						</div>
						<!-- Divider -->
						<div class="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
							Catatan: Saran bersifat umum. Sesuaikan dengan kondisi bisnis Anda.
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="border-t border-gray-100 bg-gray-50 px-4 py-3">
				<div class="flex justify-end">
					<button
						onclick={handleAiClose}
						class="rounded-xl bg-pink-500 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-pink-600 active:bg-pink-700"
					>
						Tutup
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
