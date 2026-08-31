import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  discoverAgentFiles,
  loadAgents,
  validateAgentText,
} from '../../lib/search-growth/frontmatter.mjs';

const root = resolve(import.meta.dirname, '..', '..');

test('discovers every current agent without treating docs and evals as agents', () => {
  const files = discoverAgentFiles(root);
  assert.equal(files.length, 277);
  assert.ok(files.includes('marketing/marketing-search-growth-orchestrator.md'));
  assert.ok(!files.includes('SEARCH-GROWTH-STACK.md'));
  assert.ok(!files.some((path) => path.startsWith('evals/')));
});

test('parses existing nested YAML frontmatter safely', () => {
  const path = 'marketing/marketing-multi-platform-publisher.md';
  const result = validateAgentText(readFileSync(join(root, path), 'utf8'), { path });
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.data.services));
});

test('rejects duplicate YAML keys', () => {
  const result = validateAgentText(`---\nname: One\nname: Two\ndescription: test\ncolor: blue\nemoji: x\n---\n# Body`, { path: 'duplicate.md' });
  assert.ok(result.errors.some((error) => error.code === 'YAML_INVALID'));
});

test('rejects missing delimiters and required fields', () => {
  const missingDelimiter = validateAgentText('# No frontmatter', { path: 'missing.md' });
  assert.ok(missingDelimiter.errors.some((error) => error.code === 'FRONTMATTER_MISSING'));

  const missingField = validateAgentText(`---\nname: Test\ndescription: Test\ncolor: blue\n---\n# Body`, { path: 'field.md' });
  assert.ok(missingField.errors.some((error) => error.message.includes("'emoji'")));
});

test('enumerates an agent without frontmatter so agent validation fails loudly', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'search-growth-agent-'));
  try {
    mkdirSync(join(fixtureRoot, 'marketing'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'marketing', 'broken-agent.md'), '# Missing frontmatter\n', 'utf8');

    assert.deepEqual(discoverAgentFiles(fixtureRoot), ['marketing/broken-agent.md']);
    const [agent] = loadAgents(fixtureRoot);
    assert.equal(agent.filePath, 'marketing/broken-agent.md');
    assert.ok(agent.errors.some((error) => error.code === 'FRONTMATTER_MISSING'));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
