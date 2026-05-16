import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseClient, isValidBranch } from '$lib/database/supabaseClient';
import bcrypt from 'bcryptjs';
import { createAuthSession } from '$lib/server/sessionStore';
import { dev } from '$app/environment';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(identifier: string): boolean {
	const now = Date.now();
	const current = loginAttempts.get(identifier);

	if (!current || now > current.resetAt) {
		loginAttempts.set(identifier, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
		return false;
	}

	if (current.count >= LOGIN_MAX_ATTEMPTS) {
		return true;
	}

	current.count += 1;
	return false;
}

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
	try {
		const clientIp = getClientAddress();
		if (isRateLimited(clientIp)) {
			return new Response(
				JSON.stringify({
					success: false,
					code: 'RATE_LIMITED',
					message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
					retryAfterSeconds: Math.ceil(LOGIN_WINDOW_MS / 1000)
				}),
				{ status: 429 }
			);
		}

		const { username, password, branch } = await request.json();
		if (!username || !password || !branch) {
			return new Response(
				JSON.stringify({
					success: false,
					code: 'VALIDATION_ERROR',
					message: 'Username dan password wajib diisi'
				}),
				{ status: 400 }
			);
		}

		if (!isValidBranch(branch)) {
			return new Response(
				JSON.stringify({ success: false, code: 'INVALID_BRANCH', message: 'Branch tidak valid' }),
				{
					status: 400
				}
			);
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
			return new Response(
				JSON.stringify({
					success: false,
					code: 'INVALID_CREDENTIALS',
					message: 'Username tidak ditemukan'
				}),
				{
					status: 401
				}
			);
		}
		// Verifikasi hash password
		const match = await bcrypt.compare(password, user.password);
		if (!match) {
			return new Response(
				JSON.stringify({ success: false, code: 'INVALID_CREDENTIALS', message: 'Password salah' }),
				{
					status: 401
				}
			);
		}

		loginAttempts.delete(clientIp);
		const authSession = createAuthSession({
			userId: user.id,
			username: user.username,
			role: user.role
		});

		cookies.set('zatiaras_sid', authSession.id, {
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24
		});

		// Sukses login
		return new Response(
			JSON.stringify({
				success: true,
				session: {
					expiresAt: authSession.expiresAt
				},
				user: {
					id: user.id,
					username: user.username,
					role: user.role
				}
			}),
			{ status: 200 }
		);
	} catch (e) {
		return new Response(
			JSON.stringify({
				success: false,
				code: 'SERVER_ERROR',
				message: 'Terjadi error pada server'
			}),
			{
				status: 500
			}
		);
	}
};
