<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loginWithUsername } from '$lib/auth/auth';
	import { validateText, validatePasswordDemo, sanitizeInput } from '$lib/utils/validation';
	import { securityUtils } from '$lib/utils/security';
	import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
	type BranchType = 'samarinda' | 'berau' | 'Balikpapan' | 'samarinda2' | 'balikpapan2';

	import { isAuthenticated } from '$lib/utils/authGuard';

	let userRole = $state('');
	let username = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	// Form validation
	let usernameError = $state('');
	let passwordError = $state('');

	let branch: BranchType = $state('samarinda') as any;
	$effect(() => {
		selectedBranch.value = branch as BranchType;
	});

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

	let showLottieSuccess = $state(false);

	let showLottieError = $state(false);
	let lottieErrorTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleSubmit() {
		errorMessage = '';
		if (!validateForm()) return;
		if (!securityUtils.checkFormRateLimit('login')) {
			errorMessage = 'Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit.';
			showLottieError = true;
			if (lottieErrorTimeout) clearTimeout(lottieErrorTimeout);
			lottieErrorTimeout = setTimeout(() => (showLottieError = false), 1200);
			return;
		}
		const sanitizedUsername = sanitizeInput(username);
		const sanitizedPassword = sanitizeInput(password);
		if (securityUtils.detectSuspiciousActivity('login', sanitizedUsername + sanitizedPassword)) {
			errorMessage = 'Aktivitas mencurigakan terdeteksi. Silakan coba lagi.';
			securityUtils.logSecurityEvent('login_attempt_blocked', {
				username: sanitizedUsername,
				reason: 'suspicious_activity'
			});
			showLottieError = true;
			if (lottieErrorTimeout) clearTimeout(lottieErrorTimeout);
			lottieErrorTimeout = setTimeout(() => (showLottieError = false), 1200);
			return;
		}
		isLoading = true;
		try {
			await loginWithUsername(sanitizedUsername, sanitizedPassword, branch);
			showLottieSuccess = true;
			await new Promise((resolve) => setTimeout(resolve, 1200));
			goto('/');
		} catch (e: any) {
			errorMessage = e.message;
			securityUtils.logSecurityEvent('login_failed', {
				username: sanitizedUsername,
				reason: 'invalid_credentials'
			});
			showLottieError = true;
			if (lottieErrorTimeout) clearTimeout(lottieErrorTimeout);
			lottieErrorTimeout = setTimeout(() => (showLottieError = false), 1200);
		} finally {
			isLoading = false;
		}
	}

	function handleUsernameChange() {
		usernameError = '';
	}
	function handlePasswordChange() {
		passwordError = '';
	}
	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !isLoading) handleSubmit();
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const reason = params.get('reason');
		const reasonMessages: Record<string, string> = {
			rate_limit: 'Terlalu banyak permintaan. Silakan tunggu sebentar lalu coba lagi.',
			session_expired: 'Sesi login Anda berakhir. Silakan login kembali.',
			unauthorized: 'Silakan login untuk melanjutkan.',
			csrf_invalid: 'Sesi keamanan berakhir. Silakan coba login kembali.'
		};

		if (reason && reasonMessages[reason]) {
			errorMessage = reasonMessages[reason];
		}

		// Jika sudah login, redirect ke dashboard
		if (await isAuthenticated()) {
			goto('/');
			return;
		}

		if (userRole === 'kasir') {
			// Session and security settings are loaded through backend APIs.
			// const lockedPages = data?.halaman_terkunci || ['laporan', 'beranda'];
			// if (lockedPages.includes('beranda')) {
			//   // showPinModal = true; // Hapus semua logic showPinModal
			// }
		}
	});
</script>

<div
	class="page-content flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-200 via-pink-100 to-pink-300 p-4"
>
	<div class="w-full max-w-sm">
		<!-- Logo dan Header -->
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-pink-500/20"
			>
				<img src="/img/logo.svg" alt="Logo ZatiarasPOS" class="h-10 w-10 object-contain" />
			</div>
			<h1 class="mb-1 text-2xl font-bold text-gray-800">ZatiarasPOS</h1>
			<p class="text-sm font-semibold text-pink-400">Aplikasi Kasir by Zatiaras</p>
		</div>

		<!-- Login Form -->
		<div class="rounded-3xl border border-white/40 bg-white/30 p-8 shadow-2xl backdrop-blur-xl">
			<h2 class="mb-6 text-center text-lg font-semibold text-gray-800">Masuk ke ZatiarasPOS</h2>

			<!-- Error Message -->
			{#if errorMessage}
				<div class="mb-6 rounded-2xl border border-red-200/50 bg-red-50/80 p-4 backdrop-blur-sm">
					<div class="flex items-center">
						<div class="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
							<svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<span class="text-sm font-medium text-red-700">{errorMessage}</span>
					</div>
				</div>
			{/if}

			<!-- Floating Success Notification with Checkmark Animation -->
			{#if showLottieSuccess}
				<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
					<div
						class="animate-fadeInUp flex flex-col items-center rounded-2xl border border-pink-200 bg-white/95 px-8 py-6 shadow-2xl backdrop-blur-sm"
					>
						<div class="checkmark-circle">
							<svg class="checkmark" viewBox="0 0 52 52">
								<circle class="checkmark-circle-path" cx="26" cy="26" r="25" fill="none" />
								<path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
							</svg>
						</div>
						<div class="mt-4 text-lg font-bold text-pink-500">Login Berhasil!</div>
					</div>
				</div>
			{/if}

			<!-- Floating Lottie Error Notification -->
			{#if showLottieError}
				<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
					<div
						class="animate-fadeInUp flex flex-col items-center rounded-2xl border border-red-200 bg-white/80 px-8 py-6 shadow-2xl"
					>
						<div
							class="mb-2 flex h-[90px] w-[90px] items-center justify-center rounded-full bg-red-100"
						>
							<svg
								class="h-16 w-16 text-red-500"
								fill="none"
								viewBox="0 0 64 64"
								stroke="currentColor"
								stroke-width="3"
							>
								<circle
									cx="32"
									cy="32"
									r="30"
									stroke="currentColor"
									stroke-width="3"
									fill="#fee2e2"
								/>
								<line
									x1="22"
									y1="22"
									x2="42"
									y2="42"
									stroke="currentColor"
									stroke-width="4"
									stroke-linecap="round"
								/>
								<line
									x1="42"
									y1="22"
									x2="22"
									y2="42"
									stroke="currentColor"
									stroke-width="4"
									stroke-linecap="round"
								/>
							</svg>
						</div>
						<div class="mt-2 text-lg font-bold text-red-500">{errorMessage || 'Login Gagal!'}</div>
					</div>
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-5"
			>
				<!-- Username Field -->
				<div>
					<label for="username" class="mb-2 block text-sm font-medium text-gray-700">
						Username
					</label>
					<div class="relative">
						<input
							id="username"
							type="text"
							bind:value={username}
							oninput={handleUsernameChange}
							onkeypress={handleKeyPress}
							class="block w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-gray-800 placeholder-gray-400 shadow-sm transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none"
							placeholder="Masukkan username"
							autocomplete="username"
							required
						/>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 text-pink-400">
							<svg
								class="h-6 w-6"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/></svg
							>
						</span>
					</div>
					{#if usernameError}
						<div class="mt-1 text-xs text-red-500">{usernameError}</div>
					{/if}
				</div>
				<!-- Password Field -->
				<div>
					<label for="password" class="mb-2 block text-sm font-medium text-gray-700">
						Password
					</label>
					<div class="relative">
						<input
							id="password"
							type="password"
							bind:value={password}
							oninput={handlePasswordChange}
							onkeypress={handleKeyPress}
							class="block w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-gray-800 placeholder-gray-400 shadow-sm transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none"
							placeholder="Masukkan password"
							autocomplete="current-password"
							required
						/>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 text-pink-400">
							<svg
								class="h-6 w-6"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/></svg
							>
						</span>
					</div>
					{#if passwordError}
						<div class="mt-1 text-xs text-red-500">{passwordError}</div>
					{/if}
				</div>
				<!-- Submit Button -->
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-3 font-bold text-white shadow-lg shadow-pink-500/10 transition-colors duration-200 hover:bg-pink-600 focus:ring-2 focus:ring-pink-300 focus:outline-none active:bg-pink-700"
					disabled={isLoading}
				>
					{#if isLoading}
						<svg
							class="h-5 w-5 animate-spin"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"
							></path></svg
						>
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
<div class="fixed right-4 bottom-4 z-40">
	<div
		class="flex min-w-[120px] items-center justify-end rounded-2xl border border-white/40 bg-white/30 px-4 py-2 shadow-lg backdrop-blur-xl"
		style="box-shadow: 0 4px 24px 0 rgba(255, 182, 193, 0.12);"
	>
		<select
			class="cursor-pointer border-none bg-transparent px-1 py-0.5 text-sm font-semibold text-gray-700 outline-none focus:ring-0 focus:outline-none"
			bind:value={branch}
			aria-label="Pilih Cabang"
		>
			<option value="samarinda">Samarinda</option>
			<option value="berau">Berau</option>
			<option value="Balikpapan">Balikpapan</option>
			<option value="samarinda2">Samarinda 2</option>
			<option value="balikpapan2">Balikpapan 2</option>
		</select>
	</div>
</div>

<style>
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(32px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fadeInUp {
		animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Checkmark Animation */
	.checkmark-circle {
		width: 90px;
		height: 90px;
		position: relative;
	}

	.checkmark {
		width: 90px;
		height: 90px;
		border-radius: 50%;
		display: block;
		stroke-width: 3;
		stroke: #ec4899;
		stroke-miterlimit: 10;
		box-shadow: inset 0 0 0 #ec4899;
		animation:
			fillCircle 0.4s ease-in-out 0.4s forwards,
			scaleCircle 0.3s ease-in-out 0.9s both;
	}

	.checkmark-circle-path {
		stroke-dasharray: 166;
		stroke-dashoffset: 166;
		stroke-width: 3;
		stroke-miterlimit: 10;
		stroke: #ec4899;
		fill: #fce7f3;
		animation: strokeCircle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
	}

	.checkmark-check {
		transform-origin: 50% 50%;
		stroke-dasharray: 48;
		stroke-dashoffset: 48;
		stroke: #ec4899;
		stroke-width: 3;
		animation: strokeCheck 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
	}

	@keyframes strokeCircle {
		100% {
			stroke-dashoffset: 0;
		}
	}

	@keyframes strokeCheck {
		100% {
			stroke-dashoffset: 0;
		}
	}

	@keyframes fillCircle {
		100% {
			box-shadow: inset 0 0 0 60px #fce7f3;
		}
	}

	@keyframes scaleCircle {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: scale3d(1.1, 1.1, 1);
		}
	}
</style>
