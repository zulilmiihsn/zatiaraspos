import { execFileSync } from 'node:child_process';

const diff = execFileSync('git', ['diff', '--cached', '--', '.env.example'], { encoding: 'utf8' });
const redacted = diff.replace(
  /^([+-]\s*(?:CLOUDFLARE_API_TOKEN|OPENROUTER_API_KEY|POS_PRICE_SIGNING_KEY|UAT_PASSWORD|DATABASE_PASSWORD|JWT_SECRET)\s*=).+$/gm,
  '$1<redacted>'
);
process.stdout.write(redacted);
