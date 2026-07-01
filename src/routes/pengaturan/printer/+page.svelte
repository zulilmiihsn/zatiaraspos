<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Store from 'lucide-svelte/icons/store';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import Phone from 'lucide-svelte/icons/phone';
	import InstagramIcon from 'lucide-svelte/icons/instagram';
	import MessageSquareHeart from 'lucide-svelte/icons/message-square-heart';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createToastManager } from '$lib/utils/ui';
	import { transactionService } from '$lib/services/transactionService';
	import { LOGO_BASE64 } from '$lib/utils/logoBase64';
	let namaToko = $state('');
	let alamat = $state('');
	let telepon = $state('');
	let instagram = $state('');
	let ucapan = $state('');
	let isSaving = $state(false);
	let activeTab = $state('detail');

	let copied = $state(false);
	function copyBase64() {
		navigator.clipboard.writeText(LOGO_BASE64);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	const defaultData = {
		namaToko: 'Zatiaras Juice',
		alamat: 'Jl. Contoh Alamat No. 123, Kota',
		telepon: '0812-3456-7890',
		instagram: '@zatiarasjuice',
		ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
	};

	async function loadPengaturan() {
		try {
			const data = (await transactionService.getOne('pengaturan')) as Record<string, string> | null;
			if (data) {
				namaToko = data.nama_toko || defaultData.namaToko;
				alamat = data.alamat || defaultData.alamat;
				telepon = data.telepon || defaultData.telepon;
				instagram = data.instagram || defaultData.instagram;
				ucapan = data.ucapan || defaultData.ucapan;
			}
		} catch {
			// loadFromLocal();
		}
	}

	function resetToDefault() {
		namaToko = defaultData.namaToko;
		alamat = defaultData.alamat;
		telepon = defaultData.telepon;
		instagram = defaultData.instagram;
		ucapan = defaultData.ucapan;
	}

	async function simpanPengaturan(event: Event) {
		event.preventDefault();
		isSaving = true;
		const data = {
			id: 1, // Always use id=1 for single row
			nama_toko: namaToko,
			alamat,
			telepon,
			instagram,
			ucapan
		};
		try {
			const existing = await transactionService.getOne('pengaturan');
			if (existing) {
				await transactionService.updateRows('pengaturan', data, { id: '1' });
			} else {
				await transactionService.insertRows('pengaturan', data);
			}
			toastManager.showToastNotification('Pengaturan berhasil disimpan!', 'success');
		} catch (e) {
			toastManager.showToastNotification('Gagal menyimpan pengaturan.', 'error');
		} finally {
			isSaving = false;
		}
	}

	// Toast management
	const toastManager = createToastManager();

	onMount(async () => {
		loadPengaturan();
	});
</script>

<!-- Top Bar Custom -->
<div
	class="sticky top-0 z-40 flex items-center border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
>
	<button
		onclick={() => goto('/pengaturan')}
		class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
	>
		<ArrowLeft class="h-5 w-5 text-gray-600" />
	</button>
	<h1 class="text-xl font-bold text-gray-800">Pengaturan Draft Struk</h1>
</div>

<div class="page-content min-h-[100dvh] flex-1 overflow-y-auto bg-white p-4 lg:p-8">
	<div
		class="mx-auto transition-all duration-300 {activeTab === 'preview' ? 'max-w-4xl' : 'max-w-xl'}"
	>
		<!-- Tabs Navigation -->
		<div
			class="mb-6 flex gap-3 overflow-x-auto pb-2"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<button
				class="min-w-[120px] flex-1 cursor-pointer rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] {activeTab ===
				'detail'
					? 'border-pink-500 bg-pink-500 text-white shadow-sm shadow-pink-500/20'
					: 'border-pink-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50/50'}"
				onclick={() => (activeTab = 'detail')}
			>
				Detail Struk
			</button>
			<button
				class="min-w-[120px] flex-1 cursor-pointer rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] {activeTab ===
				'preview'
					? 'border-pink-500 bg-pink-500 text-white shadow-sm shadow-pink-500/20'
					: 'border-pink-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50/50'}"
				onclick={() => (activeTab = 'preview')}
			>
				Tampilan Struk
			</button>
		</div>

		{#if activeTab === 'detail'}
			<!-- Form Section -->
			<div class="rounded-2xl bg-white pb-6 sm:pb-8">
				<form class="space-y-5" onsubmit={simpanPengaturan}>
					<div
						class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
					>
						<label
							for="nama-toko"
							class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700"
						>
							<Store class="h-4 w-4 text-pink-500" />
							Nama Toko
						</label>
						<input
							type="text"
							id="nama-toko"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-4 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10"
							bind:value={namaToko}
							maxlength="50"
							required
						/>
					</div>
					<div
						class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
					>
						<label
							for="alamat"
							class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700"
						>
							<MapPin class="h-4 w-4 text-pink-500" />
							Alamat
						</label>
						<input
							type="text"
							id="alamat"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-4 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10"
							bind:value={alamat}
							maxlength="100"
							required
						/>
					</div>
					<div
						class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
					>
						<label
							for="telepon"
							class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700"
						>
							<Phone class="h-4 w-4 text-pink-500" />
							Nomor Telepon
						</label>
						<input
							type="text"
							id="telepon"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-4 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10"
							bind:value={telepon}
							maxlength="20"
							required
						/>
					</div>
					<div
						class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
					>
						<label
							for="instagram"
							class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700"
						>
							<InstagramIcon class="h-4 w-4 text-pink-500" />
							Instagram
						</label>
						<input
							type="text"
							id="instagram"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-4 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10"
							bind:value={instagram}
							maxlength="30"
						/>
					</div>
					<div
						class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
					>
						<label
							for="ucapan"
							class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700"
						>
							<MessageSquareHeart class="h-4 w-4 text-pink-500" />
							Ucapan di Bawah Struk
						</label>
						<textarea
							id="ucapan"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-4 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10"
							rows="3"
							bind:value={ucapan}
							maxlength="120"
						></textarea>
					</div>
					<div class="mt-8 flex flex-col gap-3">
						<button
							type="submit"
							class="w-full rounded-xl bg-pink-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:bg-pink-600 active:scale-[0.98] disabled:opacity-50"
							disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</button
						>
						<button
							type="button"
							class="w-full rounded-xl border-[1.5px] border-pink-100 bg-white px-6 py-3.5 text-sm font-bold text-pink-500 shadow-sm transition-all hover:bg-pink-50 active:scale-[0.98]"
							onclick={resetToDefault}
							disabled={isSaving}>Reset Default</button
						>
					</div>
				</form>
			</div>
		{:else}
			<!-- Preview Section -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Receipt Struk Preview -->
				<div class="mx-auto w-full max-w-sm">
					<div
						class="relative overflow-hidden rounded-t-lg bg-white p-6 shadow-xl shadow-stone-200/50 sm:p-8"
						style="border-bottom: 4px dotted #e5e7eb;"
					>
						<div
							class="font-mono text-black"
							style="font-size: 14px; line-height: 1.5; padding: 8px;"
						>
							<div style="text-align:center; margin-bottom: 16px;">
								<img
									src={LOGO_BASE64}
									style="width:120px; height:120px; margin:0 auto 12px; display:block; filter:grayscale(100%) contrast(1.2);"
									alt="Logo"
								/>
								<div style="font-weight:bold; font-size: 20px; text-transform: uppercase;">
									{namaToko || 'Nama Toko'}
								</div>
								<div style="font-size: 13px; margin-top: 4px;">{alamat || 'Alamat Toko'}</div>
								{#if instagram || telepon}
									<div style="font-size: 13px; margin-top: 2px;">
										{instagram}{instagram && telepon ? ' | ' : ''}{telepon}
									</div>
								{/if}
							</div>

							<div style="border-bottom: 1px dashed #333; margin-bottom: 12px;"></div>

							<div
								style="text-align:left; font-size: 13px; margin-bottom: 12px; display: flex; justify-content: space-between;"
							>
								<div>nama pelanggan</div>
								<div>01/01/2024 10.00</div>
							</div>

							<table
								style="width:100%; font-size: 14px; border-collapse:collapse; margin-bottom: 12px;"
							>
								<tbody>
									<tr>
										<td style="text-align:left; padding-bottom:4px; font-weight: bold;"
											>Jus Mangga <span style="font-size: 12px; font-weight: normal;">x2</span></td
										>
										<td style="text-align:right; padding-bottom:4px;">Rp20.000</td>
									</tr>
									<tr>
										<td style="font-size: 12px; padding-left: 8px; color: #333;">+ Topping Nata</td>
										<td style="font-size: 12px; text-align:right; color: #333;">Rp4.000</td>
									</tr>
									<tr>
										<td
											colspan="2"
											style="font-size: 12px; padding-left: 8px; padding-bottom:8px; color: #333; font-style: italic;"
											>Tanpa Gula, Sedikit Es</td
										>
									</tr>
									<tr>
										<td style="text-align:left; padding-bottom:4px; font-weight: bold;"
											>Jus Alpukat <span style="font-size: 12px; font-weight: normal;">x1</span></td
										>
										<td style="text-align:right; padding-bottom:4px;">Rp15.000</td>
									</tr>
								</tbody>
							</table>

							<div style="border-bottom: 1px dashed #333; margin-bottom: 12px;"></div>

							<table
								style="width:100%; font-size: 14px; border-collapse:collapse; margin-bottom: 24px;"
							>
								<tbody>
									<tr>
										<td style="text-align:left; padding-bottom:4px;">Total:</td>
										<td style="text-align:right; font-weight: bold; font-size: 16px;">Rp35.000</td>
									</tr>
									<tr>
										<td style="text-align:left; font-size: 13px; padding-top: 4px;">Metode:</td>
										<td style="text-align:right; font-size: 13px; padding-top: 4px;">Tunai</td>
									</tr>
									<tr>
										<td style="text-align:left; font-size: 13px;">Dibayar:</td>
										<td style="text-align:right; font-size: 13px;">Rp50.000</td>
									</tr>
									<tr>
										<td style="text-align:left; font-size: 13px;">Kembalian:</td>
										<td style="text-align:right; font-size: 13px;">Rp15.000</td>
									</tr>
								</tbody>
							</table>

							<div style="text-align:center; font-size: 13px; white-space:pre-line;">
								{ucapan || 'Terima kasih'}
							</div>
						</div>
					</div>
				</div>

				<!-- ASCII (Base64) Info Card -->
				<div
					class="flex flex-col justify-between rounded-2xl border-[1.5px] border-pink-100 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]"
				>
					<div>
						<h3 class="text-lg font-bold text-stone-800">Kode ASCII (Base64) Logo</h3>
						<p class="mt-2 text-sm leading-relaxed text-stone-600">
							Ini adalah representasi teks ASCII (Base64) dari logo toko. Data gambar ini ditanamkan
							langsung dalam kode agar struk dapat dicetak kapan saja, bahkan saat perangkat kasir
							sedang offline.
						</p>
						<div class="mt-4 rounded-xl border border-stone-200 bg-stone-900 p-4">
							<div
								class="max-h-40 overflow-y-auto pr-1 font-mono text-[10px] break-all text-stone-400 select-all"
							>
								{LOGO_BASE64}
							</div>
						</div>
					</div>

					<div class="mt-6">
						<button
							type="button"
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all duration-200 hover:bg-pink-600 active:scale-[0.98]"
							onclick={copyBase64}
						>
							{#if copied}
								<!-- Check Icon -->
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
								Tersalin!
							{:else}
								<!-- Copy Icon -->
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
								</svg>
								Salin Kode ASCII
							{/if}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if toastManager.showToast}
	<ToastNotification
		show={toastManager.showToast}
		message={toastManager.toastMessage}
		type={toastManager.toastType}
		position="top"
	/>
{/if}
