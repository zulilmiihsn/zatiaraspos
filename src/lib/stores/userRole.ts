import { writable } from 'svelte/store';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get } from 'svelte/store';
import { selectedBranch } from './selectedBranch';
import { session } from '$lib/auth/auth';

// Store untuk user role dan profile
export const userRole = writable<string | null>(null);
export const userProfile = writable<any>(null);

if (typeof window !== 'undefined') {
  const saved = sessionStorage.getItem('zatiaras_session');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.user) {
        userRole.set(parsed.user.role);
        userProfile.set(parsed.user);
      }
    } catch {}
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

// Fungsi untuk validasi role dengan Supabase (fallback/refresh)
export async function validateRoleWithSupabase() {
  try {
    const { data: { session } } = await getSupabaseClient(get(selectedBranch)).auth.getSession();
    if (!session?.user) {
      clearUserRole();
      return false;
    }
    
    const { data: profile, error } = await getSupabaseClient(get(selectedBranch))
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