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
				DB?: any;
				DB_SAMARINDA_GROUP?: any;
				DB_BALIKPAPAN_GROUP?: any;
				DB_BERAU_GROUP?: any;
				STORAGE?: any;
				REALTIME_HUB?: any;
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
