import { getD1Database, normalizeBranch, type BranchId } from '$lib/server/branchResolver';

export interface AuthSession {
	id: string;
	userId: string;
	username: string;
	role: string;
	branch?: string;
	createdAt: number;
	expiresAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function buildSessionId(branch: BranchId): string {
	return `${branch}.${crypto.randomUUID()}`;
}

function parseSessionBranch(sessionId: string | undefined): BranchId | null {
	if (!sessionId) return null;
	const separatorIndex = sessionId.indexOf('.');
	if (separatorIndex <= 0) return null;

	try {
		return normalizeBranch(sessionId.slice(0, separatorIndex));
	} catch {
		return null;
	}
}

function getSessionDb(platform: App.Platform | undefined, branch: BranchId) {
	return getD1Database(platform?.env as Record<string, unknown> | undefined, branch);
}

export async function createAuthSession(
	platform: App.Platform | undefined,
	payload: {
		branch: BranchId;
		userId: string;
		username: string;
		role: string;
	}
): Promise<AuthSession> {
	const now = Date.now();
	const session: AuthSession = {
		id: buildSessionId(payload.branch),
		userId: payload.userId,
		username: payload.username,
		role: payload.role,
		branch: payload.branch,
		createdAt: now,
		expiresAt: now + SESSION_TTL_MS
	};

	const db = getSessionDb(platform, payload.branch);
	await db
		.prepare(
			`INSERT INTO auth_sessions (
				id,
				cabang_id,
				user_id,
				username,
				role,
				created_at,
				expires_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			session.id,
			payload.branch,
			payload.userId,
			payload.username,
			payload.role,
			session.createdAt,
			session.expiresAt
		)
		.run();
	await db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now).run();

	return session;
}

export async function getAuthSession(
	platform: App.Platform | undefined,
	sessionId: string | undefined
): Promise<AuthSession | null> {
	const branch = parseSessionBranch(sessionId);
	if (!branch || !sessionId) {
		return null;
	}

	const row = (await getSessionDb(platform, branch)
		.prepare(
			`SELECT
				id,
				cabang_id,
				user_id,
				username,
				role,
				created_at,
				expires_at
			FROM auth_sessions
			WHERE id = ? AND expires_at > ?
			LIMIT 1`
		)
		.bind(sessionId, Date.now())
		.first()) as {
		id: string;
		cabang_id: BranchId;
		user_id: string;
		username: string;
		role: string;
		created_at: number;
		expires_at: number;
	} | null;

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		branch: row.cabang_id,
		userId: row.user_id,
		username: row.username,
		role: row.role,
		createdAt: row.created_at,
		expiresAt: row.expires_at
	};
}

export async function deleteAuthSession(
	platform: App.Platform | undefined,
	sessionId: string | undefined
): Promise<void> {
	const branch = parseSessionBranch(sessionId);
	if (!branch || !sessionId) {
		return;
	}

	await getSessionDb(platform, branch)
		.prepare('DELETE FROM auth_sessions WHERE id = ?')
		.bind(sessionId)
		.run();
}
