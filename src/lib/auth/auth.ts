import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { setUserRole, clearUserRole } from '$lib/stores/userRole';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { setSecuritySettings, clearSecuritySettings } from '$lib/stores/securitySettings';

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
	// Login dengan dummy credentials
	async login(
		username: string,
		password: string
	): Promise<{ success: boolean; message: string; user?: any }> {
		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Dummy credentials - in production this would be validated against backend
		const dummyCredentials = {
			admin: { username: 'admin', password: 'admin123', role: 'admin' },
			kasir: { username: 'kasir', password: 'kasir123', role: 'kasir' }
		};

		const user = Object.values(dummyCredentials).find(
			(cred: any) => cred.username === username && cred.password === password
		);

		if (user) {
			const token = generateDummyToken(user);
			const sessionData = {
				isAuthenticated: true,
				user: { ...user, password: undefined }, // Don't store password
				token
			};

			session.set(sessionData);
			return { success: true, message: 'Login berhasil', user: sessionData.user };
		}

		return { success: false, message: 'Username atau password salah' };
	},

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

	// Validate token (dummy validation)
	validateToken(token: string): boolean {
		// Dummy token validation - in production this would validate against backend
		return Boolean(token && token.length > 10);
	},

	// Logout function
	logout() {
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
	}
};

// Generate dummy JWT-like token
function generateDummyToken(user: any): string {
	const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = btoa(
		JSON.stringify({
			sub: user.username,
			role: user.role,
			iat: Date.now(),
			exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
		})
	);
	const signature = btoa('dummy-signature-' + Math.random().toString(36));

	return `${header}.${payload}.${signature}`;
}

export async function loginWithUsername(
	username: string,
	password: string,
	branch: 'samarinda' | 'berau' | 'dev'
) {
	// Kirim ke endpoint API custom untuk verifikasi login
	const res = await fetch('/api/veriflogin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password, branch })
	});
	const result = await res.json();
	if (!result.success) throw new Error(result.message || 'Login gagal');

	// Set user role dan profile ke store (hanya sekali saat login)
	setUserRole(result.user.role, result.user);

	// Jika peran adalah 'kasir', ambil pengaturan keamanan
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

export async function getUserRole(userId: string) {
	// Removed supabase reference - use dataService instead
	// const { data, error } = await supabase
	//   .from('profil')
	//     .select('role')
	//     .eq('id', userId)
	//     .single();
	// if (error) throw error;
	// return data.role;
	return 'admin'; // Fallback for now
}

export async function logout() {
	// Supabase client is not directly used here, so it's commented out.
	// If you have a global supabase client, ensure it's imported and used correctly.
	// await supabase.auth.signOut();
	// Clear user role dari store saat logout
	clearUserRole();
	session.set({ isAuthenticated: false, user: null, token: null });
	localStorage.removeItem('zatiaras_session'); // Changed to localStorage
	clearSecuritySettings(); // Clear security settings on logout
}
