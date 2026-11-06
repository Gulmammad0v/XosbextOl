import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const uiTextPattern = /[ƏəİıŞşÇçÖöÜüĞğА-Яа-яЁё]/u;
const allowedFragments = [
  'XOŞBƏXT OL',
  "'Azərbaycan'",
  "'Русский'",
  "includes('böyük')",
  'AZERBAIJANI_CHARACTERS',
  "useState('Bakı')",
  "city || 'Bakı'",
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const file of await sourceFiles(sourceRoot)) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (!uiTextPattern.test(line) || allowedFragments.some(fragment => line.includes(fragment))) return;
    violations.push(`${relative(sourceRoot, file)}:${index + 1}: ${line.trim()}`);
  });
}

if (violations.length) {
  console.error('Hard-coded Azerbaijani/Russian UI text found outside locale files:');
  violations.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('No hard-coded Azerbaijani/Russian UI text found outside the intentional allowlist.');
