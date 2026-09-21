import { mkdir, copyFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function build({ apiBase, demo = false, outputDir = join(root, 'dist') } = {}) {
  if (!demo) {
    if (typeof apiBase !== 'string' || !apiBase.trim()) throw new Error('YPC_API_BASE is required. Use --demo only for an explicit design preview.');
    const url = new URL(apiBase);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Deployment API URL must use HTTPS without credentials, query or fragment.');
    apiBase = url.href.replace(/\/$/, '');
  }
  const output = resolve(outputDir);
  if (output === resolve(root) || ['src', 'docs', 'scripts', 'tests', '.git'].some(name => output === resolve(root, name))) throw new Error('Build output must be a separate directory.');
  await mkdir(join(output, 'src'), { recursive: true });
  await mkdir(join(output, 'mocks'), { recursive: true });
  for (const name of ['index.html', 'profile.html']) await copyFile(join(root, name), join(output, name));
  for (const entry of await readdir(join(root, 'src'), { withFileTypes: true })) {
    if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await copyFile(join(root, 'src', entry.name), join(output, 'src', entry.name));
  }
  await copyFile(join(root, 'mocks', 'scenario.json'), join(output, 'mocks', 'scenario.json'));
  await writeFile(join(output, 'src', 'runtime-config.js'), `// Public API endpoint; never put secrets here.\nexport const apiBase = ${JSON.stringify(demo ? null : apiBase)};\n`);
  await writeFile(join(output, '.nojekyll'), '');
  const manifest = { mode: demo ? 'demo' : 'api', apiBase: demo ? null : apiBase };
  await writeFile(join(output, 'build-info.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { outputDir: output, ...manifest };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await build({ apiBase: process.env.YPC_API_BASE, demo: process.argv.includes('--demo') }), null, 2));
}
