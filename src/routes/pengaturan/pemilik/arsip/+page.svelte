<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Archive from 'lucide-svelte/icons/archive';
	import Download from 'lucide-svelte/icons/download';
	import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';
	import { userRole } from '$lib/stores/userRole.svelte';

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

	let beforeYear = $state(currentYear - 1);
	let loading = $state(false);
	let showConfirm = $state(false);
	let result = $state<{
		ok: boolean;
		count: number;
		message?: string;
		filename?: string;
	} | null>(null);

	onMount(() => {
		if (userRole.value !== 'pemilik') goto('/unauthorized');
	});

	async function doArchive() {
		showConfirm = false;
		loading = true;
		result = null;
		try {
			const res = await fetch('/api/archive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ before_year: beforeYear })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'Gagal mengarsipkan');

			// Unduh salinan ke perangkat owner (selain tersimpan di cloud).
			if (data.content) {
				const blob = new Blob([data.content], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = data.filename || 'arsip.json';
				a.click();
				URL.revokeObjectURL(url);
			}
			result = data;
		} catch (e) {
			result = { ok: false, count: 0, message: e instanceof Error ? e.message : 'Gagal' };
		} finally {
			loading = false;
		}
	}
</script>

<div class="page-content flex min-h-screen flex-col bg-gray-50">
	<!-- Header -->
	<div
		class="sticky top-0 z-40 flex w-full items-center justify-start border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
	>
		<button
			onclick={() => goto('/pengaturan/pemilik')}
			class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
			aria-label="Kembali"
		>
			<ArrowLeft class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="text-xl font-bold text-gray-800">Arsip Data</h1>
	</div>

	<div class="mx-auto w-full max-w-lg px-4 py-4 md:py-8">
		<!-- Kartu penjelasan -->
		<div class="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
			<div class="mb-3 flex items-center gap-3">
				<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
					<Archive class="h-6 w-6 text-emerald-500" />
				</div>
				<div>
					<h2 class="text-base font-bold text-gray-800">Arsipkan Transaksi Lama</h2>
					<p class="text-xs text-gray-500">Meringankan database, data tetap aman</p>
				</div>
			</div>
			<ul class="space-y-1.5 text-sm text-gray-600">
				<li class="flex gap-2">
					<span class="text-emerald-500">•</span> Transaksi lama diunduh sebagai file <b>.json</b> +
					disimpan ke cloud
				</li>
				<li class="flex gap-2">
					<span class="text-emerald-500">•</span> File bisa <b>dipulihkan</b> kapan saja (tidak hilang)
				</li>
				<li class="flex gap-2">
					<span class="text-emerald-500">•</span> Setelah itu dihapus dari database aktif agar ruang
					lega
				</li>
				<li class="flex gap-2">
					<span class="text-emerald-500">•</span> <b>Laporan & ringkasan</b> tetap utuh
				</li>
			</ul>
		</div>

		<!-- Pilih tahun + tombol -->
		<div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
			<label for="thn" class="mb-2 block text-sm font-medium text-gray-700">
				Arsipkan semua transaksi <b>sebelum tahun</b>
			</label>
			<select
				id="thn"
				bind:value={beforeYear}
				disabled={loading}
				class="mb-4 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none disabled:opacity-60"
			>
				{#each years as y}
					<option value={y}>{y}</option>
				{/each}
			</select>

			<button
				onclick={() => (showConfirm = true)}
				disabled={loading}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
			>
				{#if loading}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></span>
					Memproses...
				{:else}
					<Download class="h-5 w-5" />
					Arsipkan & Unduh
				{/if}
			</button>
		</div>

		<!-- Hasil -->
		{#if result}
			<div class="mt-4" transition:slide|local>
				{#if result.ok && result.count > 0}
					<div
						class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
					>
						<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
						<div class="text-sm text-emerald-800">
							<b>{result.count} baris</b> berhasil diarsipkan & diunduh (<code class="text-xs"
								>{result.filename}</code
							>). Salinan juga tersimpan di cloud. Database kini lebih lega.
						</div>
					</div>
				{:else if result.ok}
					<div class="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
						{result.message || 'Tidak ada transaksi lama untuk diarsipkan.'}
					</div>
				{:else}
					<div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
						Gagal: {result.message}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Modal konfirmasi -->
{#if showConfirm}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="mx-auto w-full max-w-md rounded-t-2xl bg-white p-6 pb-8 shadow-lg"
			transition:slide|local
		>
			<h3 class="mb-2 text-lg font-bold text-gray-800">Konfirmasi Arsip</h3>
			<p class="mb-5 text-sm text-gray-600">
				Semua transaksi <b>sebelum {beforeYear}</b> akan diunduh + disimpan ke cloud, lalu
				<b>dihapus dari database aktif</b>. Data bisa dipulihkan dari file arsip kapan saja.
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (showConfirm = false)}
					class="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-600 hover:bg-gray-200"
				>
					Batal
				</button>
				<button
					onclick={doArchive}
					class="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600"
				>
					Ya, Arsipkan
				</button>
			</div>
		</div>
	</div>
{/if}
