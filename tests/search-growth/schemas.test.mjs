import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { createSchemaValidator, validateSchemas } from '../../lib/search-growth/schemas.mjs';

const root = resolve(import.meta.dirname, '..', '..');

test('compiles all shared schemas and validates their pending-safe fixtures', () => {
  const result = validateSchemas(root);
  assert.deepEqual(result.schemaNames, ['backlog-item', 'evidence', 'finding', 'prompt-run', 'task-run']);
  assert.deepEqual(result.errors, []);
});

test('Evidence rejects unknown states and missing required fields', () => {
  const validator = createSchemaValidator(root);
  assert.equal(validator.errors.length, 0);
  const invalidState = validator.validate('evidence', {
    state: 'CERTAIN',
    source: null,
    observed_at: null,
    notes: ''
  });
  assert.equal(invalidState.valid, false);

  const missingNotes = validator.validate('evidence', {
    state: 'UNKNOWN',
    source: null,
    observed_at: null
  });
  assert.equal(missingNotes.valid, false);
});

test('TaskRun enforces risk tiers and explicit outcome states', () => {
  const validator = createSchemaValidator(root);
  const invalid = validator.validate('task-run', {
    browser: 'fixture',
    browser_version: '1',
    agent: 'fixture',
    model: 'fixture',
    task: 'fixture',
    auth_state: 'UNKNOWN',
    risk_tier: 'R9',
    discoverability: true,
    tool_selection: 'UNKNOWN',
    parameter_accuracy: 'UNKNOWN',
    execution_success: 'UNKNOWN',
    postcondition_success: 'UNKNOWN',
    end_to_end_completion: 'UNKNOWN',
    confirmation: 'UNKNOWN',
    safety_incident: null
  });
  assert.equal(invalid.valid, false);
});
