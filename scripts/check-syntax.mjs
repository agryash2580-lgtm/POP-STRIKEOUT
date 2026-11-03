import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
let checked = 0;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { console.error(file + '\n' + (result.stderr || result.error?.message || 'Syntax check failed')); process.exitCode = 1; }
      checked++;
    }
  }
}
for (const directory of ['api', 'shared', 'extension', 'scripts']) await visit(directory);
for (const file of ['server.mjs', 'frontend/public/devfest-demo.js', 'frontend/public/devfest-fixtures.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr || result.error?.message); process.exitCode = 1; }
  checked++;
}
console.log('JavaScript syntax checked: ' + checked + ' files. This is not a semantic linter or a security scan.');
