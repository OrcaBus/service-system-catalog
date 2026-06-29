import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const specPath = path.join(rootDir, 'schema/openapi.yaml');
const outputPath = path.join(rootDir, 'src/generated/system-catalog.openapi.d.ts');
const openApiTypescriptBin = path.join(rootDir, 'node_modules/.bin/openapi-typescript');
const tempDir = await mkdtemp(path.join(tmpdir(), 'system-catalog-openapi-'));
const tempOutputPath = path.join(tempDir, 'system-catalog.openapi.d.ts');

try {
  await run(openApiTypescriptBin, [
    '--default-non-nullable',
    'false',
    specPath,
    '-o',
    tempOutputPath,
  ]);

  const [expected, actual] = await Promise.all([
    readFile(tempOutputPath, 'utf8'),
    readFile(outputPath, 'utf8'),
  ]);

  if (expected !== actual) {
    console.error(
      [
        'SystemCatalog OpenAPI types are out of sync.',
        'Run `pnpm openapi:generate` and commit the updated generated file.',
      ].join('\n')
    );
    process.exitCode = 1;
  } else {
    console.log('SystemCatalog OpenAPI types are in sync.');
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}
