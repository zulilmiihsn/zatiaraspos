import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	compilerOptions: {
		warningFilter: (warning) => {
			// Suppress specific compiler warnings
			const suppressed = [
				'a11y_',
				'state_referenced_locally',
				'svelte_component_deprecated',
				'css_unused_selector'
			];
			if (suppressed.some((prefix) => warning.code.startsWith(prefix))) return false;
			return true;
		}
	},

	kit: {
		csrf: {
			trustedOrigins: ['self']
		},
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
