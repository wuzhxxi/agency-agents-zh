import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { loadRegistry, validateAgents, validateRegistry } from '../../lib/search-growth/registry.mjs';

const root = resolve(import.meta.dirname, '..', '..');

test('validates all agents, registry paths, eval paths and handoffs', () => {
  const result = validateAgents(root);
  assert.equal(result.agents.length, 277);
  assert.deepEqual(result.errors, []);
});

test('rejects duplicate ids, path traversal and unknown handoffs', () => {
  const registry = structuredClone(loadRegistry(root));
  registry.agents[1].id = registry.agents[0].id;
  registry.agents[2].file_path = '../outside.md';
  registry.agents[3].handoff_targets.push('missing-agent');
  const errors = validateRegistry(root, registry);
  const codes = new Set(errors.map((error) => error.code));
  assert.ok(codes.has('REGISTRY_DUPLICATE_ID'));
  assert.ok(codes.has('REGISTRY_PATH_ESCAPE'));
  assert.ok(codes.has('REGISTRY_UNKNOWN_HANDOFF'));
});

test('allows a null eval only for the phase-1 orchestrator limitation', () => {
  const registry = structuredClone(loadRegistry(root));
  registry.agents.find((agent) => agent.id === 'seo-specialist').eval_path = null;
  const errors = validateRegistry(root, registry);
  assert.ok(errors.some((error) => error.code === 'REGISTRY_EVAL_REQUIRED'));
});
