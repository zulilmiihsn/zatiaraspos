import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG_FILE = 'wrangler.pages.jsonc';
const BACKUP_DIR = 'backups/d1';
const BRANCHES_BY_BINDING = {
	DB_SAMARINDA_GROUP: ['samarinda', 'samarinda2'],
	DB_BALIKPAPAN_GROUP: ['balikpapan', 'balikpapan2'],
	DB_BERAU_GROUP: ['berau']
};

function stripJsonc(input) {
	return input
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '')
		.replace(/,\s*([}\]])/g, '$1');
}

function run(command, args) {
	const result = spawnSync(command, args, {
		stdio: 'inherit',
		shell: process.platform === 'win32'
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed`);
	}
}

function sqlString(value) {
	if (value === null || value === undefined) return 'NULL';
	return `'${String(value).replaceAll("'", "''")}'`;
}

async function recordRun(databaseName, branches, row) {
	const values = branches
		.map(
			(branch) =>
				`(${sqlString(`${row.id}:${branch}`)}, ${sqlString(branch)}, ${sqlString(databaseName)}, ${sqlString(row.operation)}, ${sqlString(row.status)}, ${sqlString(row.filePath)}, ${row.fileSizeBytes ?? 'NULL'}, ${sqlString(row.message)}, ${sqlString(row.startedAt)}, ${sqlString(row.finishedAt)})`
		)
		.join(',');

	try {
		run('npx', [
			'wrangler',
			'd1',
			'execute',
			databaseName,
			'--config',
			CONFIG_FILE,
			'--remote',
			'--command',
			`INSERT INTO d1_backup_runs (id, branch_id, database_name, operation, status, file_path, file_size_bytes, message, started_at, finished_at) VALUES ${values}`
		]);
	} catch {
		// Backup file is source of truth; DB run history is best effort.
	}
}

const config = JSON.parse(stripJsonc(await readFile(CONFIG_FILE, 'utf8')));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = join(BACKUP_DIR, timestamp);
await mkdir(outputDir, { recursive: true });

for (const database of config.d1_databases || []) {
	const databaseName = database.database_name;
	const branches = BRANCHES_BY_BINDING[database.binding] || [database.binding || databaseName];
	const outputFile = join(outputDir, `${databaseName}.sql`);
	const startedAt = new Date().toISOString();
	const id = crypto.randomUUID();

	try {
		run('npx', [
			'wrangler',
			'd1',
			'export',
			databaseName,
			'--config',
			CONFIG_FILE,
			'--remote',
			'--skip-confirmation',
			'--output',
			outputFile
		]);
		const fileInfo = await stat(outputFile);
		await recordRun(databaseName, branches, {
			id,
			operation: 'backup',
			status: 'success',
			filePath: outputFile,
			fileSizeBytes: fileInfo.size,
			message: 'export completed',
			startedAt,
			finishedAt: new Date().toISOString()
		});
	} catch (error) {
		await recordRun(databaseName, branches, {
			id,
			operation: 'backup',
			status: 'failed',
			filePath: outputFile,
			fileSizeBytes: null,
			message: error instanceof Error ? error.message : String(error),
			startedAt,
			finishedAt: new Date().toISOString()
		});
		throw error;
	}
}

console.log(`D1 backup complete: ${outputDir}`);
