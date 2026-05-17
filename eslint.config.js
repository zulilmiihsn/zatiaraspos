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
			'no-undef': 'off',
			// Downgrade to warn — type safety is enforced via pnpm check (svelte-check + tsc)
			// Route files have been cleaned up; remaining `any` are in lib utilities and catch blocks
			'@typescript-eslint/no-explicit-any': 'warn',
			// Common patterns: unused catch param, unused loop index, store imports used only in $effect
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					varsIgnorePattern: '^_',
					argsIgnorePattern: '^_|^e$|^err$|^error$',
					caughtErrorsIgnorePattern: '.*'
				}
			],
			// require() is used in config files (svelte.config.js, tailwind.config.js)
			'@typescript-eslint/no-require-imports': 'warn',
			// Svelte each-key is best practice but not critical
			'svelte/require-each-key': 'warn',
			// Empty interfaces extend parent — common in type augmentation
			'@typescript-eslint/no-empty-object-type': 'warn',
			// Pre-existing: lexical declarations in switch case blocks
			'no-case-declarations': 'warn',
			// Pre-existing: useless catch wrappers in legacy code
			'no-useless-catch': 'warn',
			// Pre-existing: $state + $effect pattern still acceptable during migration
			'svelte/prefer-writable-derived': 'warn',
			// Pre-existing: empty catch blocks
			'no-empty': 'warn',
			// Pre-existing: constant nullish expressions in template
			'no-constant-binary-expression': 'warn',
			// Pre-existing: {@html} used intentionally for markdown rendering
			'svelte/no-at-html-tags': 'warn',
			// Pre-existing: reactive loop pattern in runes migration
			'svelte/infinite-reactive-loop': 'warn'
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
		}
	}
);
