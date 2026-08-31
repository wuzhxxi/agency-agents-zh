import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npmCli = process.env.npm_execpath
  ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function runNpm(args, cwd) {
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
}

test('packs and installs a runnable CLI with all runtime resources', { timeout: 300_000 }, () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'search-growth-package-'));
  const packDirectory = join(tempRoot, 'pack');
  const installDirectory = join(tempRoot, 'install');
  try {
    mkdirSync(packDirectory, { recursive: true });
    const packed = runNpm(['pack', '--json', '--pack-destination', packDirectory], root);
    assert.equal(packed.status, 0, `${packed.stdout}\n${packed.stderr}`);
    const packMetadata = JSON.parse(packed.stdout);
    assert.equal(packMetadata.length, 1);
    const tarballPath = join(packDirectory, packMetadata[0].filename);
    assert.ok(existsSync(tarballPath), `tarball missing: ${tarballPath}`);

    const included = new Set(packMetadata[0].files.map((file) => file.path));
    for (const required of [
      'lib/search-growth/frontmatter.mjs',
      'lib/search-growth/catalog.mjs',
      'scripts/search-growth.mjs',
      'search-growth/registry.json',
      'evals/manifest.json',
      'CATALOG.md',
      'AGENT-LIST.md',
      'README.md',
      'README.zh-TW.md',
      'SEARCH-GROWTH-STACK.md',
      'docs/search-growth-engineering.md',
    ]) {
      assert.ok(included.has(required), `tarball is missing ${required}`);
    }

    const installed = runNpm([
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefix',
      installDirectory,
      tarballPath,
    ], root);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);

    const packageDirectory = join(installDirectory, 'node_modules', 'agency-agents-zh');
    const binPath = join(
      installDirectory,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'search-growth.cmd' : 'search-growth',
    );
    assert.ok(existsSync(binPath), `installed bin missing: ${binPath}`);
    const installedCli = join(packageDirectory, 'scripts', 'search-growth.mjs');
    assert.ok(existsSync(installedCli));
    assert.ok(existsSync(join(packageDirectory, 'search-growth', 'registry.json')));

    for (const command of [
      ['agents', 'validate'],
      ['schemas', 'validate'],
      ['evals', 'validate'],
      ['catalog', 'check'],
    ]) {
      // Windows .cmd shims are shell-bound and the workspace path may contain
      // an ampersand; invoke the same installed entrypoint directly there.
      const result = process.platform === 'win32'
        ? spawnSync(process.execPath, [installedCli, ...command, '--json'], {
          cwd: installDirectory,
          encoding: 'utf8',
          timeout: 120_000,
        })
        : spawnSync(binPath, [...command, '--json'], {
          cwd: installDirectory,
          encoding: 'utf8',
          timeout: 120_000,
        });
      assert.equal(result.status, 0, `${command.join(' ')}\n${result.stdout}\n${result.stderr}`);
      assert.equal(JSON.parse(result.stdout).ok, true, command.join(' '));
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
