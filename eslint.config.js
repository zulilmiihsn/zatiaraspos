import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// Disable some accessibility rules that are too strict for this project
			'svelte/a11y-label-has-associated-control': 'warn',
			'svelte/a11y-click-events-have-key-events': 'warn',
			'svelte/a11y-no-static-element-interactions': 'warn',
			'svelte/a11y-no-noninteractive-element-interactions': 'warn',
			'svelte/a11y-interactive-supports-focus': 'warn',
			'svelte/a11y-consider-explicit-label': 'warn',
			'svelte/element-invalid-self-closing-tag': 'warn',
			'svelte/attribute-illegal-colon': 'warn'
		}
	}
);
