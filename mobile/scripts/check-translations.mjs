import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const languages = ['az', 'en', 'ru'];
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child, path) : [path];
  });
}

const keySets = new Map();
for (const language of languages) {
  const source = await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), 'utf8');
  keySets.set(language, new Set(flatten(JSON.parse(source))));
}

const baseline = keySets.get('az');
const failures = [];
for (const language of languages.slice(1)) {
  const current = keySets.get(language);
  const missing = [...baseline].filter(key => !current.has(key));
  const extra = [...current].filter(key => !baseline.has(key));
  if (missing.length) failures.push(`${language}: missing ${missing.join(', ')}`);
  if (extra.length) failures.push(`${language}: extra ${extra.join(', ')}`);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const literalKeyPattern = /(?:\bt|translate)\(\s*(['"])([^'"`$]+)\1/gu;
for (const file of await sourceFiles(sourceRoot)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(literalKeyPattern)) {
    const key = match[2];
    const pluralized = [...baseline].some(candidate => candidate.startsWith(`${key}_`));
    if (!baseline.has(key) && !pluralized) failures.push(`${relative(sourceRoot, file)}: unknown translation key ${key}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Translation keys match (${baseline.size} keys in ${languages.join(', ')}).`);
