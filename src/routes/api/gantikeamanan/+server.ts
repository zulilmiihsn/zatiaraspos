import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { usernameLama, usernameBaru, passwordLama, passwordBaru, branch } = await request.json();
		if (!usernameLama || !usernameBaru || !passwordLama || !passwordBaru || !branch) {
			return new Response(JSON.stringify({ success: false, message: 'Semua field wajib diisi.' }), {
				status: 400
			});
		}
		const supabase = getSupabaseClient(branch);
		// Ambil user dari tabel profil
		const { data: user, error } = await supabase
			.from('profil')
			.select('id, username, password')
			.eq('username', usernameLama)
			.single();
		if (error || !user) {
			return new Response(
				JSON.stringify({ success: false, message: 'Username lama tidak ditemukan.' }),
				{ status: 404 }
			);
		}
		// Verifikasi password lama
		const match = await bcrypt.compare(passwordLama, user.password);
		if (!match) {
			return new Response(JSON.stringify({ success: false, message: 'Password lama salah.' }), {
				status: 401
			});
		}
		// Hash password baru
		const hashedPassword = await bcrypt.hash(passwordBaru, 10);
		// Update username dan password
		const { error: updateError } = await supabase
			.from('profil')
			.update({ username: usernameBaru, password: hashedPassword })
			.eq('id', user.id);
		if (updateError) {
			return new Response(
				JSON.stringify({ success: false, message: 'Gagal update username/password.' }),
				{ status: 500 }
			);
		}
		return new Response(
			JSON.stringify({ success: true, message: 'Username dan password berhasil diubah.' }),
			{ status: 200 }
		);
	} catch (e) {
		return new Response(JSON.stringify({ success: false, message: 'Terjadi error pada server.' }), {
			status: 500
		});
	}
};
