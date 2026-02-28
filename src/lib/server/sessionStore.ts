import { randomUUID } from 'node:crypto';

export interface AuthSession {
	id: string;
	userId: string;
	username: string;
	role: string;
	createdAt: number;
	expiresAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, AuthSession>();

export function createAuthSession(payload: {
	userId: string;
	username: string;
	role: string;
}): AuthSession {
	const now = Date.now();
	const session: AuthSession = {
		id: randomUUID(),
		userId: payload.userId,
		username: payload.username,
		role: payload.role,
		createdAt: now,
		expiresAt: now + SESSION_TTL_MS
	};

	sessions.set(session.id, session);
	cleanupExpiredSessions();

	return session;
}

export function getAuthSession(sessionId: string | undefined): AuthSession | null {
	if (!sessionId) {
		return null;
	}

	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	if (Date.now() > session.expiresAt) {
		sessions.delete(sessionId);
		return null;
	}

	return session;
}

export function deleteAuthSession(sessionId: string | undefined): void {
	if (!sessionId) {
		return;
	}

	sessions.delete(sessionId);
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [id, session] of sessions.entries()) {
		if (now > session.expiresAt) {
			sessions.delete(id);
		}
	}
}
