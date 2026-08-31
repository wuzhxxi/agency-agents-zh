import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { parseDocument } from 'yaml';

export const AGENT_DIRECTORIES = Object.freeze([
  'academic',
  'company',
  'design',
  'engineering',
  'finance',
  'game-development',
  'gis',
  'hr',
  'legal',
  'marketing',
  'paid-media',
  'product',
  'project-management',
  'sales',
  'security',
  'spatial-computing',
  'specialized',
  'supply-chain',
  'support',
  'testing'
]);

export const REQUIRED_FRONTMATTER_FIELDS = Object.freeze([
  'name',
  'description',
  'color',
  'emoji'
]);

export function toPosixPath(value) {
  return value.split(sep).join('/');
}

export function parseAgentMarkdown(text, { path = '<memory>' } = {}) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const errors = [];

  if (lines[0] !== '---') {
    return {
      path,
      data: null,
      body: normalized,
      frontmatter: '',
      errors: [{ code: 'FRONTMATTER_MISSING', path, line: 1, message: 'Missing opening --- delimiter.' }]
    };
  }

  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex === -1) {
    return {
      path,
      data: null,
      body: '',
      frontmatter: lines.slice(1).join('\n'),
      errors: [{ code: 'FRONTMATTER_UNCLOSED', path, line: 1, message: 'Missing closing --- delimiter.' }]
    };
  }

  const frontmatter = lines.slice(1, closingIndex).join('\n');
  let document;
  try {
    document = parseDocument(frontmatter, {
      customTags: [],
      merge: false,
      prettyErrors: true,
      uniqueKeys: true
    });
  } catch (error) {
    errors.push({ code: 'YAML_INVALID', path, line: 1, message: error.message });
  }

  if (document) {
    for (const error of document.errors) {
      const line = error.linePos?.[0]?.line ? error.linePos[0].line + 1 : 1;
      errors.push({ code: 'YAML_INVALID', path, line, message: error.message });
    }
  }

  let data = null;
  if (document && document.errors.length === 0) {
    try {
      data = document.toJS({ maxAliasCount: 0 });
    } catch (error) {
      errors.push({ code: 'YAML_UNSAFE_OR_INVALID', path, line: 1, message: error.message });
    }
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    errors.push({ code: 'FRONTMATTER_NOT_MAPPING', path, line: 1, message: 'Frontmatter must be a YAML mapping.' });
  }

  const body = lines.slice(closingIndex + 1).join('\n').trim();
  return { path, data, body, frontmatter, errors };
}

export function validateAgentText(text, { path = '<memory>' } = {}) {
  const parsed = parseAgentMarkdown(text, { path });
  const errors = [...parsed.errors];

  if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      const value = parsed.data[field];
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({
          code: 'FRONTMATTER_FIELD_INVALID',
          path,
          line: 1,
          message: `Frontmatter field '${field}' must be a non-empty string.`
        });
      }
    }
  }

  if (!parsed.body) {
    errors.push({ code: 'AGENT_BODY_EMPTY', path, line: 1, message: 'Agent Markdown body is empty.' });
  }

  return { ...parsed, errors };
}

export function discoverAgentFiles(root) {
  const files = [];

  function walk(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Enumerate every Markdown file first; validation must surface missing
        // or malformed frontmatter instead of silently dropping the file.
        files.push(toPosixPath(relative(root, absolute)));
      }
    }
  }

  for (const directory of AGENT_DIRECTORIES) {
    walk(join(root, directory));
  }

  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

export function loadAgents(root) {
  return discoverAgentFiles(root).map((filePath) => {
    const result = validateAgentText(readFileSync(join(root, filePath), 'utf8'), { path: filePath });
    return { filePath, ...result };
  });
}
