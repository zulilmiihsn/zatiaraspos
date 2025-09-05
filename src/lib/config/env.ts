// Environment configuration
export const config = {
	// OpenRouter API Configuration
	// Dapatkan API key dari: https://openrouter.ai/keys
	OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY || '',
	
	// Environment
	NODE_ENV: import.meta.env.MODE || 'development',
	
	// API Endpoints
	OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
	
	// Model configuration
	MODEL: 'deepseek/deepseek-chat',
	
	// Request configuration
	MAX_TOKENS: 2000,
	TEMPERATURE: 0.7,
};

// Validation
if (!config.OPENROUTER_API_KEY && config.NODE_ENV === 'production') {
	console.warn('VITE_OPENROUTER_API_KEY tidak diset di environment production');
}
