import {mkdir, readdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const source = path.join(root, 'extension');
const files = (await readdir(source)).filter(name => /\.(js|css|html|png|md|woff2)$/.test(name));
for (const browser of ['chromium', 'firefox']) {
  const destination = path.join(root, 'dist', 'pop', browser);
  await mkdir(destination, {recursive: true});
  for (const name of files) await copyFile(path.join(source, name), path.join(destination, name));
  const manifest = await readFile(path.join(source, browser === 'firefox' ? 'manifest.firefox.json' : 'manifest.json'));
  await writeFile(path.join(destination, 'manifest.json'), manifest);
  const version = JSON.parse(manifest.toString()).version;
  const archive = path.join(root, 'public', 'pop-' + browser + '-' + version + '.zip');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $env:POP_PACKAGE_DIR -File).FullName -DestinationPath $env:POP_PACKAGE_ZIP -Force'], {
    env: {...process.env, POP_PACKAGE_DIR: destination, POP_PACKAGE_ZIP: archive}, encoding: 'utf8', windowsHide: true
  });
  if (result.status !== 0) throw Error(result.stderr || 'Package creation failed.');
  const legacy = path.join(root, 'public', browser === 'chromium' ? 'pop-extension.zip' : 'pop-firefox.zip');
  try { await copyFile(archive, legacy); }
  catch { console.warn('The previous ZIP is open or locked. Use the new versioned package below.'); }
  await mkdir(path.join(root,'frontend','public'),{recursive:true});
  await copyFile(archive,path.join(root,'frontend','public',path.basename(archive)));
  await copyFile(archive,path.join(root,'frontend','public',path.basename(legacy)));
  console.log(browser + ': ' + destination + '\nZIP: ' + archive);
}
