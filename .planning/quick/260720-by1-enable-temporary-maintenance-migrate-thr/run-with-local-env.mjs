import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('command required');

const childEnv = { ...process.env };
for (const file of ['.env', '.env.local']) {
	if (!existsSync(file)) continue;
	for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		childEnv[match[1]] = value;
	}
}

const result = spawnSync(command, args, {
	env: childEnv,
	stdio: 'inherit',
	shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);
