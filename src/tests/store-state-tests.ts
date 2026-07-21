import assert from 'node:assert/strict';
import { createServer } from 'vite';

process.env.NODE_ENV = 'production';
const { render } = await import('svelte/server');

const server = await createServer({
	appType: 'custom',
	mode: 'production',
	logLevel: 'error',
	server: { middlewareMode: true }
});

try {
	const module = await server.ssrLoadModule('/src/tests/StoreStateHarness.svelte');
	const result = render(module.default);
	assert.match(result.body, /data-total="24000"/);
	assert.match(result.body, /data-online-can-pay="true"/);
	assert.match(result.body, /data-offline-method="tunai"/);
	assert.match(result.body, /data-mode="pengeluaran"/);
	assert.match(result.body, /data-name=""/);
	console.log('Store state tests passed.');
} finally {
	const cacheModule = await server.ssrLoadModule('/src/lib/utils/cache.ts').catch(() => null);
	cacheModule?.smartCache?.destroy();
	await server.close();
}
