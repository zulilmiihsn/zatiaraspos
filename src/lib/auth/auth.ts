import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { setUserRole, clearUserRole } from '$lib/stores/userRole';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import type { BranchKey } from '$lib/database/supabaseClient';
import { setSecuritySettings, clearSecuritySettings } from '$lib/stores/securitySettings';
import { clearCsrfTokenCache, fetchWithCsrfRetry } from '$lib/utils/csrf';
import { getApiErrorMessage, reportApiFailure } from '$lib/utils/errorHandling';

// Session store
export const session = writable<{
	isAuthenticated: boolean;
	user: unknown;
	token: unknown;
}>({
	isAuthenticated: false,
	user: null,
	token: null
});

if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('zatiaras_session');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (parsed.isAuthenticated && parsed.user) {
				session.set(parsed);
			}
		} catch (e) {
			console.error('Gagal mem-parsing sesi dari localStorage:', e);
		}
	}
}

// Authentication functions
export const auth = {
	// Check if user is authenticated
	isAuthenticated(): boolean {
		const currentSession = get(session) as any;
		return Boolean(currentSession?.isAuthenticated);
	},

	// Get current user
	getCurrentUser() {
		const currentSession = get(session);
		return currentSession?.user || null;
	},

	// Check if user has specific role
	hasRole(role: string): boolean {
		const user = this.getCurrentUser();
		return (user as any)?.role === role;
	},

	// Logout function
	async logout() {
		if (browser) {
			try {
				await fetchWithCsrfRetry('/api/logout', {
					method: 'POST',
					headers: {}
				});
			} catch {
				// no-op
			}
		}

		// Clear session store
		session.set({
			isAuthenticated: false,
			user: null,
			token: null
		});

		// Clear localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem('zatiaras_session');
			localStorage.removeItem('selectedBranch');
		}

		// Clear user role and profile
		clearUserRole();
		clearSecuritySettings();
		clearCsrfTokenCache();
	}
};

export async function loginWithUsername(
	username: string,
	password: string,
	branch: BranchKey
) {
	const res = await fetchWithCsrfRetry('/api/veriflogin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password, branch })
	});
	const result = await res.json().catch(() => ({}));
	if (!res.ok || !result.success) {
		reportApiFailure(result, res.status, '/api/veriflogin');
		throw new Error(getApiErrorMessage(result, res.status, 'Login gagal'));
	}

	// Jika peran adalah 'kasir', ambil pengaturan keamanan TERLEBIH DAHULU
	if (result.user.role === 'kasir') {
		try {
			const { data, error } = await getSupabaseClient(branch)
				.from('pengaturan')
				.select('pin, locked_pages')
				.eq('id', 1)
				.single();
			if (!error && data) {
				setSecuritySettings({ pin: data.pin, lockedPages: data.locked_pages });
			} else {
				// Fallback atau set default jika tidak ada pengaturan
				setSecuritySettings({
					pin: '1234',
					lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat']
				});
			}
		} catch (e) {
			console.error('Error fetching security settings:', e);
			setSecuritySettings({
				pin: '1234',
				lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat']
			}); // Fallback
		}
	} else {
		clearSecuritySettings(); // Clear settings for non-kasir roles
	}

	// Set user role dan profile ke store SETELAH security settings
	setUserRole(result.user.role, result.user);

	// Tidak perlu reset/fetch cache apapun

	// Simpan session ke store dan localStorage
	const sessionData = {
		isAuthenticated: true,
		user: result.user,
		token: null // Tidak pakai token Supabase Auth
	};
	session.set(sessionData);

	// Simpan ke localStorage untuk persistensi setelah refresh
	if (typeof window !== 'undefined') {
		localStorage.setItem('zatiaras_session', JSON.stringify(sessionData));
		localStorage.setItem('selectedBranch', branch);
	}

	return result.user;
}

export async function logout() {
	if (browser) {
		try {
			await fetchWithCsrfRetry('/api/logout', {
				method: 'POST',
				headers: {}
			});
		} catch {
			// no-op
		}
	}

	// Clear user role dari store saat logout
	clearUserRole();
	session.set({ isAuthenticated: false, user: null, token: null });
	localStorage.removeItem('zatiaras_session'); // Changed to localStorage
	localStorage.removeItem('selectedBranch');
	clearSecuritySettings(); // Clear security settings on logout
	clearCsrfTokenCache();
}
