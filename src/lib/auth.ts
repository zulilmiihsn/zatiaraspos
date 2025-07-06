import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

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
    return currentSession?.isAuthenticated === true;
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