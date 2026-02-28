// Environment configuration
export const config = {
	// Environment
	NODE_ENV: import.meta.env.MODE || 'development',

	// API Endpoints
	OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',

	// Model configuration
	MODEL: 'deepseek/deepseek-chat',

	// Request configuration
	MAX_TOKENS: 2000,
	TEMPERATURE: 0.7
};
