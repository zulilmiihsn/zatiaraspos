<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { getSupabaseClient } from '$lib/database/supabaseClient';
	import { userRole, setUserRole } from '$lib/stores/userRole';
	import { get as storeGet } from 'svelte/store';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Shield from 'lucide-svelte/icons/shield';
	import User from 'lucide-svelte/icons/user';

	let currentUserRole = '';
	let oldUsername = '';
	let newUsername = '';
	let oldPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let userPassError = '';

	// State untuk Kasir
	let kasirOldUsername = '';
	let kasirNewUsername = '';
	let kasirOldPassword = '';
	let kasirNewPassword = '';
	let kasirConfirmPassword = '';
	let kasirUserPassError = '';

	let oldPin = '';
	let newPin = '';
	let confirmPin = '';
	let lockedPages: string[] = [];
	let pinError = '';
	let pin = '';
	let pengaturanKeamananId = '';
	let activeSecurityTab = 'pemilik'; // 'pemilik' atau 'kasir'
	let showNotifModal = false;
	let notifModalMsg = '';
	let notifModalType = 'warning'; // 'warning' | 'success' | 'error'

	onMount(async () => {
		userRole.subscribe((role) => {
			if (role !== 'pemilik') {
				goto('/unauthorized');
			}
			currentUserRole = role || '';
		});
		// Fetch PIN dan lockedPages dari Supabase
		const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
			.from('pengaturan')
			.select('id, pin, locked_pages')
			.eq('id', 1)
			.single();
		if (!error && data) {
			pin = data.pin || '';
			lockedPages = data.locked_pages || [];
			pengaturanKeamananId = data.id;
		}
	});

	async function handleChangeUserPass(e: Event) {
		e.preventDefault();
		userPassError = '';
		if (!oldUsername || !newUsername || !oldPassword || !newPassword || !confirmPassword) {
			userPassError = 'Semua field wajib diisi.';
			return;
		}
		if (newPassword !== confirmPassword) {
			userPassError = 'Konfirmasi password tidak cocok.';
			return;
		}
		if (oldUsername === newUsername) {
			userPassError = 'Username baru tidak boleh sama dengan username lama.';
			return;
		}
		try {
			const branch = storeGet(selectedBranch);
			const res = await fetch('/api/gantikeamanan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					usernameLama: oldUsername,
					usernameBaru: newUsername,
					passwordLama: oldPassword,
					passwordBaru: newPassword,
					branch
				})
			});
			const data = await res.json();
			if (!data.success) {
				userPassError = data.message || 'Gagal update username/password.';
				return;
			}
			userPassError = '';
			notifModalMsg = 'Perubahan username/password berhasil disimpan.';
			notifModalType = 'success';
			showNotifModal = true;
			oldUsername = '';
			newUsername = '';
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			userPassError = 'Terjadi error pada server.';
		}
	}

	async function handleChangeUserPassKasir(e: Event) {
		e.preventDefault();
		kasirUserPassError = '';
		if (
			!kasirOldUsername ||
			!kasirNewUsername ||
			!kasirOldPassword ||
			!kasirNewPassword ||
			!kasirConfirmPassword
		) {
			kasirUserPassError = 'Semua field wajib diisi.';
			return;
		}
		if (kasirNewPassword !== kasirConfirmPassword) {
			kasirUserPassError = 'Konfirmasi password tidak cocok.';
			return;
		}
		if (kasirOldUsername === kasirNewUsername) {
			kasirUserPassError = 'Username baru tidak boleh sama dengan username lama.';
			return;
		}
		try {
			const branch = storeGet(selectedBranch);
			const res = await fetch('/api/gantikeamanan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					usernameLama: kasirOldUsername,
					usernameBaru: kasirNewUsername,
					passwordLama: kasirOldPassword,
					passwordBaru: kasirNewPassword,
					branch,
					targetRole: 'kasir'
				})
			});
			const data = await res.json();
			if (!data.success) {
				kasirUserPassError = data.message || 'Gagal update username/password kasir.';
				return;
			}
			kasirUserPassError = '';
			notifModalMsg = 'Perubahan username/password kasir berhasil disimpan.';
			notifModalType = 'success';
			showNotifModal = true;
			kasirOldUsername = '';
			kasirNewUsername = '';
			kasirOldPassword = '';
			kasirNewPassword = '';
			kasirConfirmPassword = '';
		} catch (err) {
			kasirUserPassError = 'Terjadi error pada server.';
		}
	}

	async function savePinSettings(event: Event) {
		event.preventDefault();
		if (!oldPin.trim() || !newPin.trim() || !confirmPin.trim()) {
			pinError = 'Semua field wajib diisi.';
			return;
		}
		if (newPin !== confirmPin) {
			pinError = 'Konfirmasi PIN tidak cocok.';
			return;
		}
		if (newPin.length < 4 || newPin.length > 6 || !/^[0-9]+$/.test(newPin)) {
			pinError = 'PIN harus 4-6 digit angka.';
			return;
		}
		if (oldPin !== pin) {
			pinError = 'PIN lama salah.';
			return;
		}
		try {
			const { error } = await getSupabaseClient(storeGet(selectedBranch))
				.from('pengaturan')
				.update({ pin: newPin })
				.eq('id', pengaturanKeamananId);
			if (error) throw error;
			notifModalMsg = 'Perubahan PIN berhasil disimpan.';
			notifModalType = 'success';
			showNotifModal = true;
			oldPin = '';
			newPin = '';
			confirmPin = '';
			pinError = '';
			pin = newPin;
		} catch (error: any) {
			pinError = 'Gagal menyimpan perubahan: ' + error.message;
		}
	}

	function closeNotifModal() {
		showNotifModal = false;
	}

	function handleBackToPengaturan() {
		goto('/pengaturan/pemilik');
	}
	function handleSetTabPemilik() {
		activeSecurityTab = 'pemilik';
	}
	function handleSetTabKasir() {
		activeSecurityTab = 'kasir';
	}

	// Simpan pengaturan lockedPages ke Supabase
	async function saveLockedPages() {
		try {
			const { error } = await getSupabaseClient(storeGet(selectedBranch))
				.from('pengaturan')
				.update({ locked_pages: lockedPages })
				.eq('id', pengaturanKeamananId);
			if (error) throw error;
			notifModalMsg = 'Pengaturan halaman terkunci berhasil disimpan.';
			notifModalType = 'success';
			showNotifModal = true;
		} catch (error: any) {
			notifModalMsg = 'Gagal menyimpan pengaturan: ' + error.message;
			notifModalType = 'error';
			showNotifModal = true;
		}
	}
</script>

<div
	class="flex min-h-screen flex-col bg-gray-50"
	transition:fly={{ y: 32, duration: 320, easing: cubicOut }}
>
	<!-- Top Bar -->
	<div class="sticky top-0 z-40 flex items-center border-b border-gray-100 bg-white px-4 py-4">
		<button
			onclick={handleBackToPengaturan}
			class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
		>
			<ArrowLeft class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="text-xl font-bold text-gray-800">Ganti Keamanan</h1>
	</div>
	<div class="mx-auto w-full max-w-md flex-1 px-4 py-3 lg:max-w-6xl lg:px-8">
		<!-- Grid layout for desktop -->
		<div class="space-y-8 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
			<!-- Card: Ganti Username/Password untuk Pemilik & Kasir -->
			<div class="mb-8 rounded-2xl bg-white p-6 shadow lg:mb-0 lg:flex lg:flex-col">
				<div class="mb-4 flex gap-2">
					<button
						class="flex-1 rounded-lg py-2 text-base font-bold transition-all focus:outline-none {activeSecurityTab ===
						'pemilik'
							? 'bg-pink-500 text-white'
							: 'bg-gray-100 text-gray-700'}"
						onclick={handleSetTabPemilik}
						type="button"
					>
						<User class="mr-1 inline h-5 w-5" /> Pemilik
					</button>
					<button
						class="flex-1 rounded-lg py-2 text-base font-bold transition-all focus:outline-none {activeSecurityTab ===
						'kasir'
							? 'bg-blue-500 text-white'
							: 'bg-gray-100 text-gray-700'}"
						onclick={handleSetTabKasir}
						type="button"
					>
						<Shield class="mr-1 inline h-5 w-5" /> Kasir
					</button>
				</div>
				{#if activeSecurityTab === 'pemilik'}
					<h3 class="mb-1 flex items-center gap-2 text-lg font-bold text-pink-600">
						<User class="h-5 w-5" /> Ganti Username & Password Pemilik
					</h3>
					<p class="mb-4 text-sm text-gray-500">
						Ubah username dan password akun pemilik untuk keamanan akses penuh aplikasi.
					</p>
					<form
						class="flex flex-col gap-4 lg:flex lg:flex-1 lg:flex-col"
						onsubmit={handleChangeUserPass}
						autocomplete="off"
					>
						<div class="lg:flex lg:flex-1 lg:flex-col lg:justify-start">
							<div>
								<label for="old-username" class="mb-1 block text-sm font-medium text-gray-700"
									>Username Lama</label
								>
								<input
									id="old-username"
									type="text"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
									placeholder="Username Lama"
									bind:value={oldUsername}
									required
								/>
							</div>
							<div>
								<label for="new-username" class="mb-1 block text-sm font-medium text-gray-700"
									>Username Baru</label
								>
								<input
									id="new-username"
									type="text"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
									placeholder="Username Baru"
									bind:value={newUsername}
									required
								/>
							</div>
							<div>
								<label for="old-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Password Lama</label
								>
								<input
									id="old-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
									placeholder="Password Lama"
									bind:value={oldPassword}
									required
								/>
							</div>
							<div>
								<label for="new-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Password Baru</label
								>
								<input
									id="new-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
									placeholder="Password Baru"
									bind:value={newPassword}
									required
								/>
							</div>
							<div>
								<label for="confirm-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Konfirmasi Password Baru</label
								>
								<input
									id="confirm-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
									placeholder="Konfirmasi Password Baru"
									bind:value={confirmPassword}
									required
								/>
							</div>
							{#if userPassError}
								<div class="mt-1 text-center text-xs text-pink-600">{userPassError}</div>
							{/if}
						</div>
						<button
							class="mt-2 w-full rounded-xl bg-pink-500 py-3 font-bold text-white shadow-lg transition-colors duration-200 hover:bg-pink-600 active:bg-pink-700 lg:mt-auto"
							type="submit">Simpan Perubahan</button
						>
					</form>
				{:else}
					<h3 class="mb-1 flex items-center gap-2 text-lg font-bold text-blue-600">
						<Shield class="h-5 w-5" /> Ganti Username & Password Kasir
					</h3>
					<p class="mb-4 text-sm text-gray-500">
						Ubah kredensial akun kasir yang tersimpan di tabel profil (role kasir).
					</p>
					<form
						class="flex flex-col gap-4 lg:flex lg:flex-1 lg:flex-col"
						onsubmit={handleChangeUserPassKasir}
						autocomplete="off"
					>
						<div class="lg:flex lg:flex-1 lg:flex-col lg:justify-start">
							<div>
								<label for="kasir-old-username" class="mb-1 block text-sm font-medium text-gray-700"
									>Username Lama</label
								>
								<input
									id="kasir-old-username"
									type="text"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
									placeholder="Username Lama Kasir"
									bind:value={kasirOldUsername}
									required
								/>
							</div>
							<div>
								<label for="kasir-new-username" class="mb-1 block text-sm font-medium text-gray-700"
									>Username Baru</label
								>
								<input
									id="kasir-new-username"
									type="text"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
									placeholder="Username Baru Kasir"
									bind:value={kasirNewUsername}
									required
								/>
							</div>
							<div>
								<label for="kasir-old-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Password Lama</label
								>
								<input
									id="kasir-old-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
									placeholder="Password Lama Kasir"
									bind:value={kasirOldPassword}
									required
								/>
							</div>
							<div>
								<label for="kasir-new-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Password Baru</label
								>
								<input
									id="kasir-new-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
									placeholder="Password Baru Kasir"
									bind:value={kasirNewPassword}
									required
								/>
							</div>
							<div>
								<label for="kasir-confirm-password" class="mb-1 block text-sm font-medium text-gray-700"
									>Konfirmasi Password Baru</label
								>
								<input
									id="kasir-confirm-password"
									type="password"
									class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
									placeholder="Konfirmasi Password Baru Kasir"
									bind:value={kasirConfirmPassword}
									required
								/>
							</div>
							{#if kasirUserPassError}
								<div class="mt-1 text-center text-xs text-blue-600">{kasirUserPassError}</div>
							{/if}
						</div>
						<button
							class="mt-2 w-full rounded-xl bg-blue-500 py-3 font-bold text-white shadow-lg transition-colors duration-200 hover:bg-blue-600 active:bg-blue-700 lg:mt-auto"
							type="submit">Simpan Perubahan Kasir</button
						>
					</form>
				{/if}
			</div>
			<!-- Card: Ganti PIN -->
			<div class="mb-8 rounded-2xl bg-white p-6 shadow lg:mb-0 lg:flex lg:flex-col">
				<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-pink-600">
					<Shield class="h-5 w-5" /> Ganti PIN Keamanan
				</h3>
				<p class="mb-4 text-sm text-gray-500">
					Ubah PIN keamanan untuk mengunci akses ke halaman penting. PIN harus 4-6 digit angka.
				</p>
				<form
					class="flex flex-col gap-4 lg:flex lg:flex-1 lg:flex-col"
					onsubmit={savePinSettings}
					autocomplete="off"
				>
					<div class="lg:flex lg:flex-1 lg:flex-col lg:justify-start">
						<div>
							<label for="old-pin" class="mb-1 block text-sm font-medium text-gray-700"
								>PIN Lama</label
							>
							<input
								id="old-pin"
								type="password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
								placeholder="PIN Lama"
								bind:value={oldPin}
								required
							/>
						</div>
						<div>
							<label for="new-pin" class="mb-1 block text-sm font-medium text-gray-700"
								>PIN Baru</label
							>
							<input
								id="new-pin"
								type="password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
								placeholder="PIN Baru"
								bind:value={newPin}
								required
							/>
						</div>
						<div>
							<label for="confirm-pin" class="mb-1 block text-sm font-medium text-gray-700"
								>Konfirmasi PIN Baru</label
							>
							<input
								id="confirm-pin"
								type="password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
								placeholder="Konfirmasi PIN Baru"
								bind:value={confirmPin}
								required
							/>
						</div>
						{#if pinError}
							<div class="mt-1 text-center text-xs text-pink-600">{pinError}</div>
						{/if}
					</div>
					<button
						class="mt-2 w-full rounded-xl bg-pink-500 py-3 font-bold text-white shadow-lg transition-colors duration-200 hover:bg-pink-600 active:bg-pink-700 lg:mt-auto"
						type="submit">Simpan PIN</button
					>
				</form>
			</div>
			<!-- Card: Pengaturan Halaman Terkunci -->
			<div class="mb-8 rounded-2xl bg-white p-6 shadow lg:mb-0 lg:flex lg:flex-col">
				<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-pink-600">
					<Shield class="h-5 w-5" /> Pengaturan Halaman Terkunci
				</h3>
				<p class="mb-6 text-sm text-gray-500">
					Pilih halaman yang ingin dikunci dengan PIN. Halaman yang dikunci akan meminta PIN saat
					diakses.
				</p>
				<div class="lg:flex lg:flex-1 lg:flex-col lg:justify-start">
					<div class="mb-4 flex flex-col gap-3">
						<label class="flex cursor-pointer items-center gap-3 select-none">
							<span class="relative inline-block h-5 w-5">
								<input
									type="checkbox"
									bind:group={lockedPages}
									value="beranda"
									class="peer absolute h-5 w-5 cursor-pointer opacity-0"
								/>
								<span
									class="block h-5 w-5 rounded-full border-2 border-pink-400 bg-white transition-colors duration-200 peer-checked:bg-pink-500"
								></span>
							</span>
							<span class="font-medium text-gray-700">Beranda</span>
						</label>
						<label class="flex cursor-pointer items-center gap-3 select-none">
							<span class="relative inline-block h-5 w-5">
								<input
									type="checkbox"
									bind:group={lockedPages}
									value="catat"
									class="peer absolute h-5 w-5 cursor-pointer opacity-0"
								/>
								<span
									class="block h-5 w-5 rounded-full border-2 border-pink-400 bg-white transition-colors duration-200 peer-checked:bg-pink-500"
								></span>
							</span>
							<span class="font-medium text-gray-700">Catat</span>
						</label>
						<label class="flex cursor-pointer items-center gap-3 select-none">
							<span class="relative inline-block h-5 w-5">
								<input
									type="checkbox"
									bind:group={lockedPages}
									value="laporan"
									class="peer absolute h-5 w-5 cursor-pointer opacity-0"
								/>
								<span
									class="block h-5 w-5 rounded-full border-2 border-pink-400 bg-white transition-colors duration-200 peer-checked:bg-pink-500"
								></span>
							</span>
							<span class="font-medium text-gray-700">Laporan</span>
						</label>
					</div>
				</div>
				<button
					class="mt-2 w-full rounded-xl bg-pink-500 py-3 font-bold text-white shadow-lg transition-colors duration-200 hover:bg-pink-600 active:bg-pink-700 lg:mt-auto"
					type="button"
					onclick={saveLockedPages}>Simpan Pengaturan</button
				>
			</div>
		</div>
		{#if showNotifModal}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
				<div
					class="animate-slideUpModal flex w-full max-w-xs flex-col items-center rounded-2xl border-2 bg-white px-8 py-7 shadow-2xl"
					style="border-color: {notifModalType === 'success'
						? '#facc15'
						: notifModalType === 'error'
							? '#ef4444'
							: '#facc15'};"
				>
					<div
						class="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
						style="background: {notifModalType === 'success'
							? '#fef9c3'
							: notifModalType === 'error'
								? '#fee2e2'
								: '#fef9c3'};"
					>
						{#if notifModalType === 'success'}
							<svg
								class="h-10 w-10 text-yellow-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10" fill="#fef9c3" />
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12l2 2 4-4"
									stroke="#facc15"
									stroke-width="2"
								/>
							</svg>
						{:else if notifModalType === 'error'}
							<svg
								class="h-10 w-10 text-red-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10" fill="#fee2e2" />
								<line
									x1="9"
									y1="9"
									x2="15"
									y2="15"
									stroke="#ef4444"
									stroke-width="2"
									stroke-linecap="round"
								/>
								<line
									x1="15"
									y1="9"
									x2="9"
									y2="15"
									stroke="#ef4444"
									stroke-width="2"
									stroke-linecap="round"
								/>
							</svg>
						{:else}
							<svg
								class="h-10 w-10 text-yellow-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10" fill="#fef9c3" />
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 8v4m0 4h.01"
									stroke="#facc15"
									stroke-width="2"
								/>
							</svg>
						{/if}
					</div>
					<div class="mb-2 text-center text-base font-semibold text-gray-700">{notifModalMsg}</div>
					<button
						class="mt-2 w-full rounded-lg bg-yellow-400 py-2 font-semibold text-white"
						onclick={closeNotifModal}>Tutup</button
					>
				</div>
			</div>
		{/if}
	</div>
</div>
