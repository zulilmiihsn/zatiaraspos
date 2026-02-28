declare global {
	namespace App {
		interface Locals {
			authSession: {
				id: string;
				userId: string;
				username: string;
				role: string;
				createdAt: number;
				expiresAt: number;
			} | null;
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
