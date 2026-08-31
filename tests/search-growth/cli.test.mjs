import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const cli = resolve(root, 'scripts', 'search-growth.mjs');

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: resolve(root, '..'),
    encoding: 'utf8'
  });
}

test('agents list exposes the five registry entries as JSON', () => {
  const result = run('agents', 'list', '--json');
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.agents.length, 5);
  assert.ok(payload.agents.some((agent) => agent.id === 'search-growth-orchestrator'));
});

test('evals list reports pending cases without pass results', () => {
  const result = run('evals', 'list', '--json');
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.evaluation_count, 4);
  assert.equal(payload.total_cases, 51);
  assert.ok(payload.evaluations.every((evaluation) => evaluation.status === 'pending'));
  assert.ok(!result.stdout.includes('"passed"'));
});

test('validation commands return machine-readable success', () => {
  for (const [group, action] of [
    ['agents', 'validate'],
    ['schemas', 'validate'],
    ['regressions', 'check'],
    ['evals', 'validate'],
    ['catalog', 'check']
  ]) {
    const result = run(group, action, '--json');
    assert.equal(result.status, 0, `${group} ${action}\n${result.stdout}\n${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
});

test('unknown commands fail with usage exit code', () => {
  const result = run('unknown', 'command');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown command/);
});
