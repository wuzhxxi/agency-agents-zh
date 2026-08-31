import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

const EXPECTED_SCHEMAS = Object.freeze([
  'backlog-item',
  'evidence',
  'finding',
  'prompt-run',
  'task-run'
]);

function schemaDirectory(root) {
  return join(root, 'search-growth', 'schemas');
}

function exampleDirectory(root) {
  return join(root, 'search-growth', 'examples');
}

function parseJsonFile(path, errors) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push({ code: 'JSON_INVALID', path, message: error.message });
    return null;
  }
}

export function createSchemaValidator(root) {
  const errors = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemas = new Map();
  const files = readdirSync(schemaDirectory(root))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();

  for (const file of files) {
    const name = file.replace(/\.schema\.json$/, '');
    const schema = parseJsonFile(join(schemaDirectory(root), file), errors);
    if (schema) schemas.set(name, schema);
  }

  for (const expected of EXPECTED_SCHEMAS) {
    if (!schemas.has(expected)) {
      errors.push({ code: 'SCHEMA_MISSING', path: `search-growth/schemas/${expected}.schema.json`, message: `Required schema '${expected}' is missing.` });
    }
  }
  for (const name of schemas.keys()) {
    if (!EXPECTED_SCHEMAS.includes(name)) {
      errors.push({ code: 'SCHEMA_UNEXPECTED', path: `search-growth/schemas/${name}.schema.json`, message: `Unexpected schema '${name}'.` });
    }
  }

  for (const [name, schema] of schemas) {
    try {
      ajv.addSchema(schema);
    } catch (error) {
      errors.push({ code: 'SCHEMA_INVALID', path: `search-growth/schemas/${name}.schema.json`, message: error.message });
    }
  }

  function validate(name, value) {
    const schema = schemas.get(name);
    if (!schema) return { valid: false, errors: [{ message: `Unknown schema '${name}'.` }] };
    let validator;
    try {
      validator = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
    } catch (error) {
      return { valid: false, errors: [{ message: error.message }] };
    }
    const valid = validator(value);
    return { valid: Boolean(valid), errors: validator.errors ?? [] };
  }

  return { ajv, schemas, errors, validate };
}

export function validateSchemas(root) {
  const validator = createSchemaValidator(root);
  const errors = [...validator.errors];

  for (const name of EXPECTED_SCHEMAS) {
    const path = join(exampleDirectory(root), `${name}.json`);
    const example = parseJsonFile(path, errors);
    if (!example) continue;
    const result = validator.validate(name, example);
    if (!result.valid) {
      errors.push({
        code: 'SCHEMA_EXAMPLE_INVALID',
        path: `search-growth/examples/${name}.json`,
        message: result.errors.map((item) => `${item.instancePath || '/'} ${item.message}`).join('; ')
      });
    }
  }

  return { schemaNames: [...validator.schemas.keys()].sort(), errors };
}
