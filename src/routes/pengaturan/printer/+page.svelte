<script lang="ts">
	import { onMount } from 'svelte';
	import { getSupabaseClient } from '$lib/database/supabaseClient';
	import { get as storeGet } from 'svelte/store';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import { goto } from '$app/navigation';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createToastManager } from '$lib/utils/ui';
	let namaToko = '';
	let alamat = '';
	let telepon = '';
	let instagram = '';
	let ucapan = '';
	let isSaving = false;

	const defaultData = {
		namaToko: 'Zatiaras Juice',
		alamat: 'Jl. Contoh Alamat No. 123, Kota',
		telepon: '0812-3456-7890',
		instagram: '@zatiarasjuice',
		ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
	};

	async function loadPengaturan() {
		// Coba load dari Supabase, fallback ke localStorage
		try {
			const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
				.from('pengaturan')
				.select('*')
				.eq('id', 1)
				.single();
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
			const { error } = await getSupabaseClient(storeGet(selectedBranch))
				.from('pengaturan')
				.upsert([data]);
			if (error) throw error;
			toastManager.showToastNotification('Pengaturan berhasil disimpan!', 'success');
		} catch (e) {
			toastManager.showToastNotification('Gagal menyimpan ke Supabase.', 'error');
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
		<svelte:component this={ArrowLeft} class="h-5 w-5 text-gray-600" />
	</button>
	<h1 class="text-xl font-bold text-gray-800">Pengaturan Draft Struk</h1>
</div>

<div class="page-content min-h-screen bg-gray-50">
	<div class="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow md:p-10">
		<h1 class="mb-6 text-center text-lg font-bold text-pink-600">Pengaturan Draft Struk</h1>
		<form class="space-y-5" onsubmit={simpanPengaturan}>
			<div>
				<label for="nama-toko" class="mb-1 block text-sm font-semibold text-gray-700"
					>Nama Toko</label
				>
				<input
					type="text"
					id="nama-toko"
					class="w-full rounded-lg border-2 border-pink-200 px-3 py-2 text-base"
					bind:value={namaToko}
					maxlength="50"
					required
				/>
			</div>
			<div>
				<label for="alamat" class="mb-1 block text-sm font-semibold text-gray-700">Alamat</label>
				<input
					type="text"
					id="alamat"
					class="w-full rounded-lg border-2 border-pink-200 px-3 py-2 text-base"
					bind:value={alamat}
					maxlength="100"
					required
				/>
			</div>
			<div>
				<label for="telepon" class="mb-1 block text-sm font-semibold text-gray-700"
					>Nomor Telepon</label
				>
				<input
					type="text"
					id="telepon"
					class="w-full rounded-lg border-2 border-pink-200 px-3 py-2 text-base"
					bind:value={telepon}
					maxlength="20"
					required
				/>
			</div>
			<div>
				<label for="instagram" class="mb-1 block text-sm font-semibold text-gray-700"
					>Instagram</label
				>
				<input
					type="text"
					id="instagram"
					class="w-full rounded-lg border-2 border-pink-200 px-3 py-2 text-base"
					bind:value={instagram}
					maxlength="30"
				/>
			</div>
			<div>
				<label for="ucapan" class="mb-1 block text-sm font-semibold text-gray-700"
					>Ucapan di Bawah Struk</label
				>
				<textarea
					id="ucapan"
					class="w-full rounded-lg border-2 border-pink-200 px-3 py-2 text-base"
					rows="3"
					bind:value={ucapan}
					maxlength="120"
				></textarea>
			</div>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row">
				<button
					type="button"
					class="order-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-6 py-2 font-semibold text-gray-700 hover:bg-gray-200 sm:order-1 sm:w-1/2"
					onclick={resetToDefault}
					disabled={isSaving}>Reset ke Default</button
				>
				<button
					type="submit"
					class="order-2 w-full rounded-lg bg-pink-500 px-6 py-2 font-bold text-white transition-colors hover:bg-pink-600 disabled:opacity-50 sm:order-2 sm:w-1/2"
					disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button
				>
			</div>
		</form>
		<div class="mt-10">
			<div class="mb-2 font-semibold text-gray-700">Preview Struk</div>
			<div
				class="rounded-lg border border-pink-200 bg-gray-50 p-4 font-mono text-sm whitespace-pre-line"
				style="max-width:350px;font-size:24px;line-height:2.0;"
			>
				<div style="text-align:center;margin-bottom:16px;line-height:1.5;">
					<div style="font-weight:bold;font-size:26px;">{namaToko}</div>
					<div style="font-weight:bold;font-size:18px;">{alamat}</div>
					{#if instagram || telepon}
						<div style="font-weight:bold;font-size:18px;">
							{instagram}{instagram && telepon ? ' ' : ''}{telepon}
						</div>
					{/if}
				</div>
				<div style="border-bottom:1px dashed #000;margin-bottom:16px;"></div>
				<div style="text-align:left;font-weight:normal;margin-bottom:16px;line-height:1.5;">
					nama pelanggan<br />
					01/01/2024 10.00<br />
				</div>
				<table style="width:100%;font-size:24px;margin-bottom:16px;">
					<tbody>
						<tr style="line-height:1.5;"
							><td style="text-align:left;">Jus Mangga x2</td><td style="text-align:right;"
								>Rp20.000</td
							></tr
						>
						<tr style="line-height:1.5;"
							><td style="font-size:18px;padding-left:8px;color:#000;">+ Topping Nata</td><td
								style="font-size:18px;text-align:right;color:#000;">Rp4.000</td
							></tr
						>
						<tr style="line-height:1.5;"
							><td colspan="2" style="font-size:18px;padding-left:8px;color:#000;"
								>Tanpa Gula, Sedikit Es, Catatan khusus</td
							></tr
						>
						<tr><td colspan="2" style="height:20px;"></td></tr>
						<tr style="line-height:1.5;"
							><td style="text-align:left;">Jus Alpukat x1</td><td style="text-align:right;"
								>Rp15.000</td
							></tr
						>
					</tbody>
				</table>
				<div style="border-bottom:1px dashed #000;margin-bottom:16px;"></div>
				<table style="width:100%;font-size:24px;margin-bottom:16px;line-height:1.5;">
					<tbody>
						<tr
							><td style="text-align:left;">Total:</td><td style="text-align:right;"
								><b>Rp35.000</b></td
							></tr
						>
						<tr
							><td style="text-align:left;">Metode:</td><td style="text-align:right;">Tunai</td></tr
						>
						<tr
							><td style="text-align:left;">Dibayar:</td><td style="text-align:right;">Rp50.000</td
							></tr
						>
						<tr
							><td style="text-align:left;">Kembalian:</td><td style="text-align:right;"
								>Rp15.000</td
							></tr
						>
					</tbody>
				</table>
				<div style="margin-top:16px;text-align:center;white-space:pre-line;line-height:1.5;">
					{ucapan}
				</div>
			</div>
		</div>
	</div>
</div>

{#if toastManager.showToast}
	<ToastNotification
		show={toastManager.showToast}
		message={toastManager.toastMessage}
		type={toastManager.toastType}
		duration={2000}
		position="top"
	/>
{/if}
