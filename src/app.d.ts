import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			authSession: {
				id: string;
				userId: string;
				username: string;
				role: string;
				branch?: string;
				createdAt: number;
				expiresAt: number;
			} | null;
		}

		interface Platform {
			env: {
				DB?: D1Database;
				DB_SAMARINDA_GROUP?: D1Database;
				DB_BALIKPAPAN_GROUP?: D1Database;
				DB_BERAU_GROUP?: D1Database;
				STORAGE?: R2Bucket;
				// DurableObjectNamespace dibiarkan longgar: tipe Cloudflare-nya menyeret
				// signature fetch/Request CF yang bentrok dengan DOM Request di publisher.
				REALTIME_HUB?: {
					idFromName(name: string): unknown;
					get(id: unknown): { fetch(request: Request): Promise<Response> };
				};
				R2_PUBLIC_URL?: string;
			};
		}
	}

	// Declare pwa-install web component
	namespace JSX {
		interface IntrinsicElements {
			'pwa-install': any;
		}
	}
}

export {};
