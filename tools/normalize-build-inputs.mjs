import {readFile, writeFile, readdir} from 'node:fs/promises';
import {join, extname} from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('A staged HOMEOSTASIS project path is required.');
const manifest = JSON.parse(await readFile(join(root, 'sfhs.project.json'), 'utf8'));
if (manifest.build.canonicalLineEnding !== 'lf') throw new Error('Expected the pinned LF build contract.');
const textTypes = new Set(['.ts', '.js', '.css', '.html', '.json', '.svg']);
const files = [join(root, 'sfhs.project.json')];
async function visit(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && textTypes.has(extname(path))) files.push(path);
  }
}
await visit(join(root, 'src'));
for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = before.replace(/\r\n?/g, '\n');
  if (after !== before) await writeFile(file, after, 'utf8');
}
console.log(`Applied the declared LF line-ending contract to ${files.length} staged text inputs.`);
