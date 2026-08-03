import { execFileSync } from 'node:child_process';

const names = execFileSync('git', ['diff', '--cached', '--name-only', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const findings = [];
const sensitiveAssignment = /^\s*(?:export\s+)?(CLOUDFLARE_API_TOKEN|OPENROUTER_API_KEY|POS_PRICE_SIGNING_KEY|UAT_PASSWORD|DATABASE_PASSWORD|JWT_SECRET)\s*=\s*(.+?)\s*$/gm;
const placeholders = /^(?:["']?)(?:|.*change[_-]?me.*|.*replace[_-]?me.*|your[_-].*|.*example.*|.*sample.*|<.*>|\$\{.*\}|process\.env\..*)(?:["']?)$/i;

for (const name of names) {
  if (/^\.env(?:\.|$)/.test(name) && name !== '.env.example') {
    findings.push(`${name}: staged environment file`);
  }
}

const diff = execFileSync('git', ['diff', '--cached', '--unified=0', '--no-color'], {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024
});
const body = diff
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .map((line) => line.slice(1))
  .join('\n');

if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body)) {
  findings.push('staged additions: private key material');
}
if (/\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/.test(body)) {
  findings.push('staged additions: OpenRouter token-like value');
}

for (const match of body.matchAll(sensitiveAssignment)) {
  const value = match[2].trim().replace(/\s+#.*$/, '');
  if (!placeholders.test(value)) findings.push(`staged additions: concrete ${match[1]} assignment`);
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`staged secret scan: PASS (${names.length} files)`);
