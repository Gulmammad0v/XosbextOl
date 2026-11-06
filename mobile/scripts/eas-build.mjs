import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) {
  console.error('Platform android və ya ios olmalıdır.');
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = 'npx';
const result = spawnSync(
  npx,
  ['eas-cli@latest', 'build', '--profile', 'development', '--platform', platform],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EAS_NO_VCS: '1',
      EAS_PROJECT_ROOT: projectRoot,
    },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
