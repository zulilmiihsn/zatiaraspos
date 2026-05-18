import Ably from 'ably';

// We initialize it lazily so it doesn't break SSR or run when not needed.
let ablyClient: Ably.Realtime | null = null;

export const getAblyClient = () => {
	// Only initialize in browser environment
	if (typeof window === 'undefined') {
		return null;
	}

	if (!ablyClient) {
		ablyClient = new Ably.Realtime({
			authUrl: '/api/ably-token',
			autoConnect: true,
		});
		
		ablyClient.connection.on('connected', () => {
			console.log('Successfully connected to Ably Realtime');
		});
		
		ablyClient.connection.on('failed', (err) => {
			console.error('Failed to connect to Ably:', err);
		});
	}

	return ablyClient;
};

export const subscribeToChannel = (channelName: string, eventName: string, callback: (message: any) => void) => {
	const client = getAblyClient();
	if (!client) return null;

	const channel = client.channels.get(channelName);
	
	const wrapper = (message: any) => {
		callback(message.data);
	};

	channel.subscribe(eventName, wrapper);

	return () => {
		channel.unsubscribe(eventName, wrapper);
	};
};
