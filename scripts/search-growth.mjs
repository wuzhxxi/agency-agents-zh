#!/usr/bin/env node

import { resolve } from 'node:path';

import { checkCatalog } from '../lib/search-growth/catalog.mjs';
import { loadEvalManifest, validateEvals } from '../lib/search-growth/evals.mjs';
import { loadRegistry, validateAgents } from '../lib/search-growth/registry.mjs';
import { scanRegressionFiles } from '../lib/search-growth/regressions.mjs';
import { validateSchemas } from '../lib/search-growth/schemas.mjs';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const positionals = args.filter((arg) => arg !== '--json');
const [group, action] = positionals;

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function formatIssue(value) {
  if (typeof value === 'string') return value;
  const location = value.path ? `${value.path}${value.line ? `:${value.line}` : ''}` : '';
  const code = value.code ? `[${value.code}] ` : '';
  return `${code}${location}${location ? ' ' : ''}${value.message ?? JSON.stringify(value)}`;
}

function printValidation(label, payload, errors, warnings = []) {
  if (jsonOutput) {
    printJson({ command: label, ok: errors.length === 0, ...payload, errors, warnings });
  } else {
    for (const warning of warnings) console.log(`WARN  ${formatIssue(warning)}`);
    for (const error of errors) console.error(`ERROR ${formatIssue(error)}`);
    console.log(`${errors.length === 0 ? 'PASS' : 'FAIL'}  ${label} (${errors.length} errors, ${warnings.length} warnings)`);
  }
  if (errors.length > 0) process.exitCode = 1;
}

function printHelp() {
  console.log(`Search Growth engineering CLI

Usage:
  search-growth agents list [--json]
  search-growth agents validate [--json]
  search-growth schemas validate [--json]
  search-growth regressions check [--json]
  search-growth evals list [--json]
  search-growth evals validate [--json]
  search-growth catalog check [--json]`);
}

function runAgentsList() {
  const registry = loadRegistry(root);
  if (jsonOutput) {
    printJson({ version: registry.version, agents: registry.agents });
    return;
  }
  console.log('ID\tSTATUS\tNAME\tFILE\tEVAL');
  for (const agent of registry.agents) {
    console.log(`${agent.id}\t${agent.status}\t${agent.name}\t${agent.file_path}\t${agent.eval_path ?? 'pending: no dedicated eval'}`);
  }
}

function runAgentsValidate() {
  const registry = loadRegistry(root);
  const result = validateAgents(root);
  printValidation('agents validate', {
    discovered_agents: result.agents.length,
    registered_search_growth_agents: registry.agents.length
  }, result.errors);
}

function runSchemasValidate() {
  const result = validateSchemas(root);
  printValidation('schemas validate', { schemas: result.schemaNames }, result.errors);
}

function runRegressionsCheck() {
  const registry = loadRegistry(root);
  const manifest = loadEvalManifest(root);
  const paths = new Set([
    ...registry.agents.map((agent) => agent.file_path),
    ...manifest.evaluations.map((evaluation) => evaluation.path),
    'SEARCH-GROWTH-STACK.md',
    'docs/search-growth-engineering.md'
  ]);
  const violations = scanRegressionFiles(root, paths);
  printValidation('regressions check', { files_scanned: paths.size }, violations);
}

function runEvalsList() {
  const result = validateEvals(root);
  const payload = {
    evaluation_count: result.evaluationCount,
    total_cases: result.totalCases,
    evaluations: result.evaluations.map((evaluation) => ({
      id: evaluation.id,
      agent_id: evaluation.agentId,
      path: evaluation.path,
      status: evaluation.status,
      cases: evaluation.cases.map((evalCase) => ({
        id: evalCase.id,
        title: evalCase.title,
        critical: evalCase.critical
      })),
      document_critical_failures: evaluation.globalCriticalFailures.length
    }))
  };
  if (jsonOutput) {
    printJson({ ...payload, errors: result.errors, warnings: result.warnings });
  } else {
    for (const evaluation of payload.evaluations) {
      console.log(`${evaluation.id}\t${evaluation.status}\t${evaluation.cases.length} cases\t${evaluation.path}`);
      for (const evalCase of evaluation.cases) {
        console.log(`  ${evalCase.critical ? 'CRITICAL' : 'standard'}\tCase ${evalCase.id}\t${evalCase.title}`);
      }
    }
    if (result.errors.length > 0) {
      for (const error of result.errors) console.error(`ERROR ${formatIssue(error)}`);
    }
  }
  if (result.errors.length > 0) process.exitCode = 1;
}

function runEvalsValidate() {
  const result = validateEvals(root);
  printValidation('evals validate', {
    evaluations: result.evaluationCount,
    cases: result.totalCases,
    statuses: [...new Set(result.evaluations.map((evaluation) => evaluation.status))]
  }, result.errors, result.warnings);
}

function runCatalogCheck() {
  const result = checkCatalog(root);
  printValidation('catalog check', { discovered_agents: result.agentCount }, result.errors, result.warnings);
}

try {
  if ((group === undefined && action === undefined) || group === 'help' || group === '--help' || group === '-h') {
    printHelp();
  } else if (group === 'agents' && action === 'list') {
    runAgentsList();
  } else if (group === 'agents' && action === 'validate') {
    runAgentsValidate();
  } else if (group === 'schemas' && action === 'validate') {
    runSchemasValidate();
  } else if (group === 'regressions' && action === 'check') {
    runRegressionsCheck();
  } else if (group === 'evals' && action === 'list') {
    runEvalsList();
  } else if (group === 'evals' && action === 'validate') {
    runEvalsValidate();
  } else if (group === 'catalog' && action === 'check') {
    runCatalogCheck();
  } else {
    console.error(`Unknown command: ${positionals.join(' ') || '<none>'}`);
    printHelp();
    process.exitCode = 2;
  }
} catch (error) {
  if (jsonOutput) printJson({ ok: false, error: error.message });
  else console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
}
