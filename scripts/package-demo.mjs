import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/devfest-offline');
const files = ['devfest.html', 'devfest.css', 'devfest-demo.js', 'devfest-fixtures.js'].map(name => 'frontend/public/' + name);
files.push('scripts/serve-demo.mjs');
const manifest = { format: 'strikeout-offline-demo-1', files: [] };
for (const relative of files) {
  const bytes = await readFile(path.join(root, relative));
  await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
  await copyFile(path.join(root, relative), path.join(output, relative));
  manifest.files.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(output, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(output, 'START-HERE.txt'), `STRIKEOUT — FICTIONAL OFFLINE DEMONSTRATION

Requires Node.js 22 or newer, installed before travel. No npm install, login,
API key or internet connection is needed to run this package.

1. Open a terminal in this folder.
2. Run: node scripts/serve-demo.mjs
3. Open: http://localhost:3031/devfest.html
4. Choose an example, acknowledge the fictional-demo notice, then explore.
5. Reset for next visitor clears results and recommendation choices.

Keep the terminal open. Stop with Ctrl+C. The server listens only on this laptop.
If the port is occupied, set DEMO_PORT to another port before starting:
  Linux/macOS: DEMO_PORT=3035 node scripts/serve-demo.mjs
  PowerShell: $env:DEMO_PORT=3035; node scripts/serve-demo.mjs

This is a bundled simulation. No live sources are searched. Recommendations are
guidance, not completed removals. Downloads contain fictional data only.
The live-site and GitHub feedback links require internet when you open them.
MANIFEST.json records the expected SHA-256 and size of each runtime file.
`);
console.log('Offline package prepared: ' + output);
console.log('Runtime files: ' + files.length + '. No credentials or application data copied.');
