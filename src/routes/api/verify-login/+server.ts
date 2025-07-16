import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/database/supabaseClient';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Username dan password wajib diisi' }), { status: 400 });
    }
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
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Terjadi error pada server' }), { status: 500 });
  }
}; 