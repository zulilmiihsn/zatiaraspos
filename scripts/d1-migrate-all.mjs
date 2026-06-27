import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function main() {
	console.log('🚀 Starting multi-shard D1 migration...');

	const isRemote = process.argv.includes('--remote');
	const flag = isRemote ? '--remote' : '--local';

	let wranglerConfig;
	try {
		const raw = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf-8');
		// Sangat sederhana JSON parse (buang komentar)
		const clean = raw.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
		wranglerConfig = JSON.parse(clean);
	} catch (err) {
		console.error('❌ Failed to read wrangler.jsonc:', err);
		process.exit(1);
	}

	const d1Databases = wranglerConfig.d1_databases;
	if (!d1Databases || !Array.isArray(d1Databases)) {
		console.error('❌ No d1_databases found in wrangler.jsonc');
		process.exit(1);
	}

	for (const db of d1Databases) {
		const binding = db.binding;
		console.log(`\n📦 Applying migrations for shard: ${binding} (${flag})`);
		try {
			execSync(`wrangler d1 migrations apply ${binding} ${flag}`, {
				stdio: 'inherit'
			});
			console.log(`✅ Success for ${binding}`);
		} catch (err) {
			console.error(`❌ Failed for ${binding}`);
			process.exit(1);
		}
	}

	console.log('\n🎉 All shards migrated successfully!');
}

main();
