import { readFile, writeFile } from 'node:fs/promises';

// Only the disposable CI checkout is modified; nothing is committed or pushed.
const run = Number(process.env.GITHUB_RUN_NUMBER);
if (!Number.isSafeInteger(run) || run < 1) {
  throw new Error('GITHUB_RUN_NUMBER must be a positive integer');
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
// The repository owns major/minor; the final component comes only from CI.
const match = /^(\d+)\.(\d+)\.0-local$/.exec(pkg.version);
if (!match) throw new Error('Expected a major.minor.0-local version in package.json');
const version = `${match[1]}.${match[2]}.${run}`;
pkg.version = version;
lock.version = version;
lock.packages[''].version = version;
await writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(`Application version: ${version}`);
