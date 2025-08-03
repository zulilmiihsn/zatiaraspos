import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import bcrypt from 'bcryptjs';
import { validateText } from '$lib/utils/validation'; // Import validateText

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { username, password, branch } = await request.json();

    // 1. Validasi Input Dasar
    if (!username || !password || !branch) {
      return new Response(JSON.stringify({ success: false, message: 'Username, password, dan branch wajib diisi' }), { status: 400 });
    }

    const usernameValidation = validateText(username, { minLength: 3, maxLength: 50 });
    if (!usernameValidation.isValid) {
      return new Response(JSON.stringify({ success: false, message: `Username tidak valid: ${usernameValidation.errors.join(', ')}` }), { status: 400 });
    }

    const passwordValidation = validateText(password, { minLength: 6 }); // Sesuaikan dengan validatePassword/validatePasswordDemo
    if (!passwordValidation.isValid) {
      return new Response(JSON.stringify({ success: false, message: `Password tidak valid: ${passwordValidation.errors.join(', ')}` }), { status: 400 });
    }

    // Pilih Supabase client sesuai branch
    const supabase = getSupabaseClient(branch);

    // Ambil user dari tabel profil
    const { data: user, error } = await supabase
      .from('profil')
      .select('id, username, password, role')
      .eq('username', username)
      .single();

    if (error || !user) {
      return new Response(JSON.stringify({ success: false, message: 'Username tidak ditemukan' }), { status: 401 });
    }

    // Verifikasi hash password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return new Response(JSON.stringify({ success: false, message: 'Password salah' }), { status: 401 });
    }

    // Sukses login
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    }), { status: 200 });
  } catch (e: any) {
    console.error("Server error in verify-login API:", e);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi error pada server' }), { status: 500 });
  }
};