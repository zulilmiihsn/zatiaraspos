import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const candidates = ['.svelte-kit/cloudflare/sw.js', '.svelte-kit/output/server/sw.js'];
const localPath = candidates.find(existsSync);
if (!localPath) throw new Error('local sw.js not found');

const local = readFileSync(localPath);
const response = await fetch(`https://zatiaraspos.pages.dev/sw.js?verify=${Date.now()}`, {
  headers: { 'cache-control': 'no-cache' }
});
if (!response.ok) throw new Error(`live sw.js returned ${response.status}`);
const live = Buffer.from(await response.arrayBuffer());
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const localHash = sha256(local);
const liveHash = sha256(live);

console.log(JSON.stringify({ localPath, status: response.status, localHash, liveHash, match: localHash === liveHash }, null, 2));
if (localHash !== liveHash) process.exit(1);
