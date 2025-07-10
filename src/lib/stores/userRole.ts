import { writable } from 'svelte/store';
import { supabase } from '$lib/database/supabaseClient';

// Store untuk user role dan profile
export const userRole = writable<string | null>(null);
export const userProfile = writable<any>(null);

// Cache TTL (24 jam)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Inisialisasi store dari localStorage saat app dimulai
if (typeof window !== 'undefined') {
  const savedRole = localStorage.getItem('userRole');
  const savedProfile = localStorage.getItem('userProfile');
  const lastValidation = localStorage.getItem('userRoleLastValidation');
  
  if (savedRole && savedProfile) {
    // Cek apakah cache masih valid (24 jam)
    const isValid = lastValidation && (Date.now() - parseInt(lastValidation)) < CACHE_TTL;
    
    if (isValid) {
      userRole.set(savedRole);
      userProfile.set(JSON.parse(savedProfile));
    } else {
      // Cache expired, clear dan akan di-refresh
      localStorage.removeItem('userRole');
      localStorage.removeItem('userProfile');
      localStorage.removeItem('userRoleLastValidation');
    }
  }
}

// Fungsi untuk set user role dan profile (dipanggil saat login)
export function setUserRole(role: string, profile: any) {
  userRole.set(role);
  userProfile.set(profile);
  
  // Simpan ke localStorage
  localStorage.setItem('userRole', role);
  localStorage.setItem('userProfile', JSON.stringify(profile));
  localStorage.setItem('userRoleLastValidation', Date.now().toString());
}

// Fungsi untuk clear user data (dipanggil saat logout)
export function clearUserRole() {
  userRole.set(null);
  userProfile.set(null);
  
  // Clear localStorage
  localStorage.removeItem('userRole');
  localStorage.removeItem('userProfile');
  localStorage.removeItem('userRoleLastValidation');
}

// Fungsi untuk validasi role dengan Supabase (fallback/refresh)
export async function validateRoleWithSupabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      clearUserRole();
      return false;
    }
    
    const { data: profile, error } = await supabase
      .from('profil')
      .select('role, username')
      .eq('id', session.user.id)
      .single();
      
    if (error || !profile) {
      clearUserRole();
      return false;
    }
    
    // Update store dan cache
    setUserRole(profile.role, profile);
    return true;
  } catch (error) {
    console.error('Error validating role with Supabase:', error);
    return false;
  }
}

// Fungsi untuk get current role (dengan fallback)
export async function getCurrentRole(): Promise<string | null> {
  let currentRole: string | null = null;
  userRole.subscribe(val => currentRole = val)();
  
  // Jika ada role di store, return
  if (currentRole) {
    return currentRole;
  }
  
  // Jika tidak ada, coba validasi dengan Supabase
  const isValid = await validateRoleWithSupabase();
  if (isValid) {
    userRole.subscribe(val => currentRole = val)();
    return currentRole;
  }
  
  return null;
} 