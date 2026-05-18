import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import Ably from 'ably';

export async function GET({ request }) {
	if (!env.ABLY_API_KEY) {
		return json({ error: 'ABLY_API_KEY not configured' }, { status: 500 });
	}

	const client = new Ably.Rest(env.ABLY_API_KEY);
	
	try {
		// Generate an Ably TokenRequest
		const tokenRequestData = await client.auth.createTokenRequest({ clientId: 'zatiaras-client' });
		return json(tokenRequestData);
	} catch (error) {
		console.error('Error generating Ably token request:', error);
		return json({ error: 'Failed to generate token' }, { status: 500 });
	}
}
