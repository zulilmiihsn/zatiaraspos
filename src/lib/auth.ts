import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/database/supabaseClient';
import { setUserRole, clearUserRole } from '$lib/stores/userRole';

// Dummy credentials - dalam produksi ini harus dari database
const DUMMY_CREDENTIALS = {
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Administrator'
  },
  kasir: {
    username: 'kasir',
    password: 'kasir123',
    role: 'kasir',
    name: 'Kasir'
  }
};

// Session store
export const session = writable<{
  isAuthenticated: boolean;
  user: any;
  token: string | null;
}>({
  isAuthenticated: false,
  user: null,
  token: null
});

// Initialize session from localStorage
if (browser) {
  const savedSession = localStorage.getItem('zatiaras_session');
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      session.set(parsed);
    } catch (error) {
      console.error('Error parsing saved session:', error);
      localStorage.removeItem('zatiaras_session');
    }
  }
}

// Subscribe to session changes and save to localStorage
if (browser) {
  session.subscribe((value) => {
    localStorage.setItem('zatiaras_session', JSON.stringify(value));
  });
}

// Authentication functions
export const auth = {
  // Login dengan dummy credentials
  async login(username: string, password: string): Promise<{ success: boolean; message: string; user?: any }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = Object.values(DUMMY_CREDENTIALS).find(
      cred => cred.username === username && cred.password === password
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

  // Logout
  logout() {
    session.set({
      isAuthenticated: false,
      user: null,
      token: null
    });
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
    return user?.role === role;
  },

  // Validate token (dummy validation)
  validateToken(token: string): boolean {
    // Dummy token validation - in production this would validate against backend
    return token && token.length > 10;
  }
};

// Generate dummy JWT-like token
function generateDummyToken(user: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }));
  const signature = btoa('dummy-signature-' + Math.random().toString(36));
  
  return `${header}.${payload}.${signature}`;
}

export async function loginWithUsername(username: string, password: string) {
  // Kirim ke endpoint API custom untuk verifikasi login
  const res = await fetch('/api/verify-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.message || 'Login gagal');

  // Set user role dan profile ke store (hanya sekali saat login)
  setUserRole(result.user.role, result.user);

  // Simpan session ke localStorage
  const sessionData = {
    isAuthenticated: true,
    user: result.user,
    token: null // Tidak pakai token Supabase Auth
  };
  session.set(sessionData);
  if (typeof window !== 'undefined') {
    localStorage.setItem('zatiaras_session', JSON.stringify(sessionData));
  }
  return result.user;
}

export async function getUserRole(userId: string) {
  const { data, error } = await supabase
    .from('profil')
    .select('role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.role;
}

export async function logout() {
  await supabase.auth.signOut();
  // Clear user role dari store saat logout
  clearUserRole();
} 