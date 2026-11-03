// TEMPORARY until @agentage/extension 0.1.0 is on npm; delete with the fallback steps in the workflows.
// `local <tgz>` points the kit dependency at a packed tarball, `registry` points it back at npm.
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = '@agentage/extension';
const RANGE = '^0.1.0';
const TARBALL_URL = 'https://registry.npmjs.org/@agentage/extension/-/extension-0.1.0.tgz';

const [mode, tarball] = process.argv.slice(2);
if (mode !== 'registry' && !(mode === 'local' && tarball)) {
  console.error('usage: node scripts/kit-lock.mjs local <path.tgz> | registry');
  process.exit(2);
}
const spec = mode === 'local' ? `file:${tarball}` : RANGE;
const resolved = mode === 'local' ? `file:${tarball}` : TARBALL_URL;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const pkg = readJson('package.json');
pkg.dependencies[NAME] = spec;
writeJson('package.json', pkg);

const lock = readJson('package-lock.json');
lock.packages[''].dependencies[NAME] = spec;
const entry = lock.packages[`node_modules/${NAME}`];
entry.resolved = resolved;
delete entry.integrity;
writeJson('package-lock.json', lock);
console.log(`${NAME}: ${spec}`);
