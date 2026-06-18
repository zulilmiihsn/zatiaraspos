import type { BranchId } from '$lib/server/branchResolver';

type AuditSession = {
	userId?: string | null;
	username?: string | null;
	role?: string | null;
};

export type AuditLogInput = {
	action: string;
	entityType: string;
	entityId?: string | number | null;
	transactionId?: string | null;
	amount?: number | null;
	metadata?: Record<string, unknown> | null;
	ipHash?: string | null;
	session?: AuditSession | null;
};

function toJson(value: Record<string, unknown> | null | undefined) {
	if (!value) return null;
	try {
		return JSON.stringify(value).slice(0, 8192);
	} catch {
		return null;
	}
}

export function auditLogStatement(db: any, branch: BranchId, input: AuditLogInput) {
	return db
		.prepare(
			`INSERT INTO audit_logs (
				id,
				branch_id,
				actor_user_id,
				actor_username,
				actor_role,
				action,
				entity_type,
				entity_id,
				transaction_id,
				amount,
				metadata,
				ip_hash,
				created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			branch,
			input.session?.userId ?? null,
			input.session?.username ?? null,
			input.session?.role ?? null,
			input.action,
			input.entityType,
			input.entityId == null ? null : String(input.entityId),
			input.transactionId ?? null,
			input.amount ?? null,
			toJson(input.metadata),
			input.ipHash ?? null,
			new Date().toISOString()
		);
}

export async function appendAuditLog(db: any, branch: BranchId, input: AuditLogInput) {
	try {
		await auditLogStatement(db, branch, input).run();
	} catch {
		// Audit table may not exist until migrations run; never block primary UX.
	}
}
