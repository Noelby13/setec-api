import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const options = process.argv.slice(2);
if (options.some(arg => !['--check', '--write'].includes(arg)) || options.length > 1) {
  console.error('Usage: node scripts/sync-contracts.mjs [--check|--write]');
  process.exit(2);
}
const write = options[0] === '--write';
let drift = false;
for (const project of ['setecweb', 'setecportal']) {
  for (const file of ['FRONTEND_API_CONTRACT.md', 'frontend-types.ts']) {
    const canonical = await readFile(path.join(root, file));
    const destination = path.join(root, '..', project, file);
    if (write) await writeFile(destination, canonical);
    try {
      if (!(await readFile(destination)).equals(canonical)) {
        console.error(`${project}/${file}: contract drift`);
        drift = true;
      }
    } catch {
      console.error(`${project}/${file}: contract copy unavailable`);
      drift = true;
    }
  }
}
if (drift) process.exitCode = 1;
else console.log(write ? 'All three contract copies synchronized.' : 'All three contract copies match the canonical API contract.');
