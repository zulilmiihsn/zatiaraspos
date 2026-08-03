import { defineConfig, devices } from '@playwright/test';

const evidenceDir =
	'.planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/playwright-production';

export default defineConfig({
	testDir: '.',
	testMatch: 'production-ui-smoke.spec.ts',
	fullyParallel: false,
	workers: 1,
	timeout: 180_000,
	expect: { timeout: 20_000 },
	outputDir: `${evidenceDir}/results`,
	reporter: [
		['list'],
		['json', { outputFile: `${evidenceDir}/report.json` }],
		['html', { outputFolder: `${evidenceDir}/html`, open: 'never' }]
	],
	use: {
		baseURL: 'https://zatiaraspos.pages.dev',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		...devices['Desktop Chrome']
	}
});
