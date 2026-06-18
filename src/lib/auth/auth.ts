import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { setUserRole, clearUserRole } from '$lib/stores/userRole.svelte';
type BranchKey = string;
import { setSecuritySettings, clearSecuritySettings } from '$lib/stores/securitySettings.svelte';
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

export async function loginWithUsername(username: string, password: string, branch: BranchKey) {
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

	// Jika peran adalah 'kasir', ambil pengaturan keamanan
	if (result.user.role === 'kasir') {
		try {
			const qs = new URLSearchParams({ table: 'pengaturan', branch }).toString();
			const settingsRes = await fetch(`/api/data?${qs}`);
			const settingsData = settingsRes.ok ? await settingsRes.json() : null;
			const row = Array.isArray(settingsData) ? settingsData[0] : null;
			if (row) {
				setSecuritySettings({ pin: row.pin, lockedPages: row.locked_pages });
			} else {
				setSecuritySettings({
					pin: '1234',
					lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat']
				});
			}
		} catch {
			setSecuritySettings({
				pin: '1234',
				lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat']
			});
		}
	} else {
		clearSecuritySettings();
	}

	// Set user role dan profile ke store SETELAH security settings
	setUserRole(result.user.role, result.user);

	// Tidak perlu reset/fetch cache apapun

	// Simpan session ke store dan localStorage
	const sessionData = {
		isAuthenticated: true,
		user: result.user,
		token: null // Session dikelola cookie backend
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
