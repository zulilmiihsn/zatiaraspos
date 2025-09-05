// Environment configuration
export const config = {
	// DeepSeek API Configuration
	// Dapatkan API key dari: https://platform.openai.com/api-keys
	DEEPSEEK_API_KEY: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
	
	// Environment
	NODE_ENV: import.meta.env.MODE || 'development',
	
	// API Endpoints
	DEEPSEEK_API_URL: 'https://api.openai.com/v1/chat/completions',
	
	// Model configuration
	DEEPSEEK_MODEL: 'deepseek-chat',
	
	// Request configuration
	MAX_TOKENS: 2000,
	TEMPERATURE: 0.7,
};

// Validation
if (!config.DEEPSEEK_API_KEY && config.NODE_ENV === 'production') {
	console.warn('DEEPSEEK_API_KEY is not set in production environment');
}
