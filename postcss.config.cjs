module.exports = {
	plugins: {
		'@tailwindcss/postcss': {},
		autoprefixer: {}
	},
	// Exclude Svelte files from PostCSS processing
	exclude: ['**/*.svelte']
};
