import { writable, get } from 'svelte/store';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { selectedBranch } from './selectedBranch';

// Store untuk user role dan profile
export const userRole = writable<string | null>(null);
export const userProfile = writable<any>(null);

// Coba inisialisasi store dari localStorage saat aplikasi dimuat
// Ini membuat peran tetap ada setelah refresh halaman
if (typeof window !== 'undefined') {
	// FIX: Menggunakan localStorage untuk persistensi sesi yang lebih baik.
	const saved = localStorage.getItem('zatiaras_session');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (parsed.user && parsed.user.role) {
				userRole.set(parsed.user.role);
				userProfile.set(parsed.user);
			}
		} catch (e) {
			console.error('Gagal mem-parsing sesi dari localStorage:', e);
		}
	}
}

// Fungsi untuk set user role dan profile (dipanggil saat login)
export function setUserRole(role: string, profile: any) {
	userRole.set(role);
	userProfile.set(profile);
}

// Fungsi untuk clear user data (dipanggil saat logout)
export function clearUserRole() {
	userRole.set(null);
	userProfile.set(null);
}

/**
 * Memvalidasi sesi dan peran pengguna dengan Supabase.
 * Dibuat lebih tangguh untuk menangani masalah jaringan tanpa langsung menghapus peran.
 * @returns {Promise<'valid' | 'invalid' | 'network_error'>} Status validasi.
 */
export async function validateRoleWithSupabase(): Promise<'valid' | 'invalid' | 'network_error'> {
	try {
		const {
			data: { session },
			error: sessionError
		} = await getSupabaseClient(get(selectedBranch)).auth.getSession();

		// Jika ada error saat mengambil sesi, kemungkinan besar masalah jaringan.
		if (sessionError) {
			console.warn(
				'Peringatan validasi peran: Gagal mengambil sesi (kemungkinan masalah jaringan).',
				sessionError.message
			);
			return 'network_error';
		}

		// Jika tidak ada sesi, pengguna tidak terotentikasi. Hapus peran.
		if (!session?.user) {
			clearUserRole();
			return 'invalid';
		}

		// Jika ada sesi, verifikasi profil dari database.
		const { data: profile, error: profileError } = await getSupabaseClient(get(selectedBranch))
			.from('profil')
			.select('role, username')
			.eq('id', session.user.id)
			.single();

		if (profileError) {
			// PGRST116 berarti profil tidak ditemukan, ini adalah status tidak valid.
			if (profileError.code === 'PGRST116') {
				console.log('Validasi gagal: Profil tidak ditemukan untuk sesi yang ada.');
				clearUserRole();
				return 'invalid';
			}
			// Error lain kemungkinan besar adalah masalah jaringan/server.
			console.warn(
				'Peringatan validasi peran: Gagal mengambil profil (kemungkinan masalah jaringan).',
				profileError.message
			);
			return 'network_error';
		}

		// Jika profil tidak ada, sesi tidak valid.
		if (!profile) {
			console.log('Validasi gagal: Profil tidak ada.');
			clearUserRole();
			return 'invalid';
		}

		// Sesi dan profil valid, update store.
		setUserRole(profile.role, profile);
		return 'valid';
	} catch (error) {
		// Menangkap error tak terduga lainnya.
		if (error instanceof Error) {
			console.warn(
				'Peringatan validasi peran: Terjadi error tak terduga (kemungkinan masalah jaringan).',
				error.message
			);
		}
		return 'network_error';
	}
}

/**
 * Mendapatkan peran pengguna saat ini dengan fallback yang tangguh.
 * Fungsi ini akan memprioritaskan peran yang sudah ada di memori/cache
 * dan hanya akan melakukan validasi penuh jika peran belum ada.
 */
export async function getCurrentRole(): Promise<string | null> {
	const currentRole = get(userRole);

	// Jika peran sudah ada di store, langsung kembalikan.
	if (currentRole) {
		return currentRole;
	}

	// Jika tidak ada, lakukan validasi dengan Supabase.
	const validationStatus = await validateRoleWithSupabase();

	// Jika validasi berhasil, ambil peran yang baru di-set dari store.
	if (validationStatus === 'valid') {
		return get(userRole);
	}

	// Jika validasi gagal ('invalid' atau 'network_error'), kembalikan null
	// karena kita tidak bisa memastikan perannya.
	return null;
}

/**
 * Mendapatkan profil pengguna saat ini dengan fallback yang tangguh.
 */
export async function getCurrentProfile(): Promise<any | null> {
	const currentProfile = get(userProfile);

	if (currentProfile) {
		return currentProfile;
	}

	const validationStatus = await validateRoleWithSupabase();

	if (validationStatus === 'valid') {
		return get(userProfile);
	}

	return null;
}
