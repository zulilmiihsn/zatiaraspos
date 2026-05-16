import { getSupabaseClient } from '$lib/database/supabaseClient';
import { selectedBranch } from './selectedBranch.svelte';

// Store untuk user role dan profile menggunakan runes Svelte 5
class RoleState {
	value = $state<string | null>(null);
}
export const userRole = new RoleState();

class ProfileState {
	value = $state<unknown | null>(null);
}
export const userProfile = new ProfileState();

// Coba inisialisasi store dari localStorage saat aplikasi dimuat
if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('zatiaras_session');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (parsed.user && parsed.user.role) {
				userRole.value = parsed.user.role;
				userProfile.value = parsed.user;
			}
		} catch (e) {
			// Silent error handling
		}
	}
}

// Fungsi untuk set user role dan profile (dipanggil saat login)
export function setUserRole(role: string, profile: unknown) {
	userRole.value = role;
	userProfile.value = profile;
}

// Fungsi untuk clear user data (dipanggil saat logout)
export function clearUserRole() {
	userRole.value = null;
	userProfile.value = null;
}

/**
 * Memvalidasi sesi dan peran pengguna dengan Supabase.
 */
export async function validateRoleWithSupabase(): Promise<'valid' | 'invalid' | 'network_error'> {
	try {
		const branch = selectedBranch.value as "samarinda" | "berau" | "Balikpapan" | "samarinda2" | "balikpapan2";
		const {
			data: { session },
			error: sessionError
		} = await getSupabaseClient(branch).auth.getSession();

		if (sessionError) {
			return 'network_error';
		}

		if (!session?.user) {
			clearUserRole();
			return 'invalid';
		}

		const { data: profile, error: profileError } = await getSupabaseClient(branch)
			.from('profil')
			.select('role, username')
			.eq('id', session.user.id)
			.single();

		if (profileError) {
			if (profileError.code === 'PGRST116') {
				clearUserRole();
				return 'invalid';
			}
			return 'network_error';
		}

		if (!profile) {
			clearUserRole();
			return 'invalid';
		}

		setUserRole(profile.role, profile);
		return 'valid';
	} catch (error) {
		return 'network_error';
	}
}

/**
 * Mendapatkan peran pengguna saat ini.
 */
export async function getCurrentRole(): Promise<string | null> {
	if (userRole.value) return userRole.value;

	const validationStatus = await validateRoleWithSupabase();
	if (validationStatus === 'valid') return userRole.value;

	return null;
}

/**
 * Mendapatkan profil pengguna saat ini.
 */
export async function getCurrentProfile(): Promise<unknown | null> {
	if (userProfile.value) return userProfile.value;

	const validationStatus = await validateRoleWithSupabase();
	if (validationStatus === 'valid') return userProfile.value;

	return null;
}
