import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { setUserRole, clearUserRole } from '$lib/stores/userRole';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { setSecuritySettings, clearSecuritySettings } from '$lib/stores/securitySettings';
import { selectedBranch } from '$lib/stores/selectedBranch'; // Import selectedBranch

// Session store
export const session = writable({
  isAuthenticated: false,
  user: null,
  token: null
});

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('zatiaras_session');
  if (saved) {
    try {
      session.set(JSON.parse(saved));
    } catch (e) {
      console.error("Error parsing session from localStorage:", e);
    }
  }
  session.subscribe(val => localStorage.setItem('zatiaras_session', JSON.stringify(val)));
}

// Authentication functions
export const auth = {
  // Logout
  logout() {
    session.set({
      isAuthenticated: false,
      user: null,
      token: null
    });
    localStorage.removeItem('zatiaras_session');
    clearUserRole(); // Clear user role from store on logout
    clearSecuritySettings(); // Clear security settings on logout
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const currentSession = get(session);
    return Boolean(currentSession?.isAuthenticated);
  },

  // Get current user
  getCurrentUser() {
    const currentSession = get(session);
    return currentSession?.user || null;
  }
};

export async function loginWithUsername(username: string, password: string, branch: 'samarinda' | 'berau' | 'dev') {
  // Kirim ke endpoint API custom untuk verifikasi login
  const res = await fetch('/api/verify-login', {
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
      const { data, error } = await getSupabaseClient(branch).from('pengaturan').select('pin, locked_pages').eq('id', 1).single();
      if (!error && data) {
        setSecuritySettings({ pin: data.pin, lockedPages: data.locked_pages });
      } else {
        // Fallback atau set default jika tidak ada pengaturan
        setSecuritySettings({ pin: '1234', lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat'] });
      }
    } catch (e) {
      console.error('Error fetching security settings:', e);
      setSecuritySettings({ pin: '1234', lockedPages: ['laporan', 'beranda', 'pengaturan', 'catat'] }); // Fallback
    }
  } else {
    clearSecuritySettings(); // Clear settings for non-kasir roles
  }

  // Simpan session hanya ke store
  const sessionData = {
    isAuthenticated: true,
    user: result.user,
    token: null // Tidak pakai token Supabase Auth
  };
  session.set(sessionData);
  return result.user;
}

export async function getUserRole(userId: string) {
  // FIX: Menggunakan getSupabaseClient dengan selectedBranch
  const { data, error } = await getSupabaseClient(get(selectedBranch))
    .from('profil')
    .select('role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.role;
}
