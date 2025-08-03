import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import bcrypt from 'bcryptjs';
import { validateText } from '$lib/utils/validation'; // Import validateText

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { usernameLama, usernameBaru, passwordLama, passwordBaru, branch } = await request.json();

    // 1. Validasi Input Dasar
    if (!usernameLama || !usernameBaru || !passwordLama || !passwordBaru || !branch) {
      return new Response(JSON.stringify({ success: false, message: 'Semua field wajib diisi.' }), { status: 400 });
    }

    const usernameValidation = validateText(usernameBaru, { minLength: 3, maxLength: 50 });
    if (!usernameValidation.isValid) {
      return new Response(JSON.stringify({ success: false, message: `Username baru tidak valid: ${usernameValidation.errors.join(', ')}` }), { status: 400 });
    }

    const passwordValidation = validateText(passwordBaru, { minLength: 6 }); // Sesuaikan dengan validatePassword/validatePasswordDemo
    if (!passwordValidation.isValid) {
      return new Response(JSON.stringify({ success: false, message: `Password baru tidak valid: ${passwordValidation.errors.join(', ')}` }), { status: 400 });
    }

    const supabase = getSupabaseClient(branch);

    // 2. Ambil user dari tabel profil
    const { data: user, error: fetchError } = await supabase
      .from('profil')
      .select('id, username, password')
      .eq('username', usernameLama)
      .single();

    if (fetchError || !user) {
      return new Response(JSON.stringify({ success: false, message: 'Username lama tidak ditemukan.' }), { status: 404 });
    }

    // 3. Verifikasi password lama
    const match = await bcrypt.compare(passwordLama, user.password);
    if (!match) {
      return new Response(JSON.stringify({ success: false, message: 'Password lama salah.' }), { status: 401 });
    }

    // 4. Periksa apakah username baru sudah ada (kecuali jika itu username yang sama)
    if (usernameBaru !== usernameLama) {
      const { data: existingUser, error: existingUserError } = await supabase
        .from('profil')
        .select('id')
        .eq('username', usernameBaru)
        .maybeSingle();

      if (existingUserError) {
        console.error("Error checking existing username:", existingUserError);
        return new Response(JSON.stringify({ success: false, message: 'Terjadi error saat memeriksa username baru.' }), { status: 500 });
      }

      if (existingUser) {
        return new Response(JSON.stringify({ success: false, message: 'Username baru sudah digunakan.' }), { status: 409 });
      }
    }

    // 5. Hash password baru
    const hashedPassword = await bcrypt.hash(passwordBaru, 10);

    // 6. Update username dan password
    const { error: updateError } = await supabase
      .from('profil')
      .update({ username: usernameBaru, password: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error("Error updating username/password:", updateError);
      return new Response(JSON.stringify({ success: false, message: 'Gagal update username/password.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: 'Username dan password berhasil diubah.' }), { status: 200 });
  } catch (e: any) {
    console.error("Server error in ganti-keamanan API:", e);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi error pada server.' }), { status: 500 });
  }
};