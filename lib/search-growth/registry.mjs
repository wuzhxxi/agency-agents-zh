import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import { loadAgents, validateAgentText } from './frontmatter.mjs';

export const REGISTRY_PATH = 'search-growth/registry.json';
export const REQUIRED_SEARCH_GROWTH_AGENT_IDS = Object.freeze([
  'aeo-foundations',
  'seo-specialist',
  'ai-citation-strategist',
  'agentic-search-optimizer',
  'search-growth-orchestrator'
]);

function issue(code, path, message, line = 1) {
  return { code, path, line, message };
}

function resolveContainedPath(root, candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '' || isAbsolute(candidate)) return null;
  const absolute = resolve(root, candidate);
  const rel = relative(resolve(root), absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return absolute;
}

export function loadRegistry(root) {
  return JSON.parse(readFileSync(join(root, REGISTRY_PATH), 'utf8'));
}

export function validateRegistry(root, registry = loadRegistry(root)) {
  const errors = [];
  if (registry?.version !== 1 || !Array.isArray(registry?.agents)) {
    return [issue('REGISTRY_INVALID', REGISTRY_PATH, 'Registry must have version 1 and an agents array.')];
  }

  const byId = new Map();
  const byPath = new Map();
  const allowedStatuses = new Set(['active', 'experimental', 'deprecated']);

  for (const [index, agent] of registry.agents.entries()) {
    const location = `${REGISTRY_PATH}#agents[${index}]`;
    if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
      errors.push(issue('REGISTRY_AGENT_INVALID', location, 'Agent entry must be an object.'));
      continue;
    }

    for (const field of ['id', 'name', 'file_path', 'role', 'status']) {
      if (typeof agent[field] !== 'string' || agent[field].trim() === '') {
        errors.push(issue('REGISTRY_FIELD_INVALID', location, `Field '${field}' must be a non-empty string.`));
      }
    }
    if (!Array.isArray(agent.responsibilities) || agent.responsibilities.length === 0 || agent.responsibilities.some((value) => typeof value !== 'string' || !value.trim())) {
      errors.push(issue('REGISTRY_RESPONSIBILITIES_INVALID', location, 'responsibilities must be a non-empty string array.'));
    }
    if (!Array.isArray(agent.handoff_targets) || agent.handoff_targets.some((value) => typeof value !== 'string' || !value.trim())) {
      errors.push(issue('REGISTRY_HANDOFFS_INVALID', location, 'handoff_targets must be a string array.'));
    }
    if (!(agent.eval_path === null || (typeof agent.eval_path === 'string' && agent.eval_path.trim()))) {
      errors.push(issue('REGISTRY_EVAL_PATH_INVALID', location, 'eval_path must be a repository path or null.'));
    }
    if (typeof agent.status === 'string' && !allowedStatuses.has(agent.status)) {
      errors.push(issue('REGISTRY_STATUS_INVALID', location, `Unsupported status '${agent.status}'.`));
    }

    if (byId.has(agent.id)) {
      errors.push(issue('REGISTRY_DUPLICATE_ID', location, `Duplicate agent id '${agent.id}'.`));
    } else if (typeof agent.id === 'string') {
      byId.set(agent.id, agent);
    }
    if (byPath.has(agent.file_path)) {
      errors.push(issue('REGISTRY_DUPLICATE_PATH', location, `Duplicate agent path '${agent.file_path}'.`));
    } else if (typeof agent.file_path === 'string') {
      byPath.set(agent.file_path, agent);
    }

    const agentAbsolute = resolveContainedPath(root, agent.file_path);
    if (!agentAbsolute) {
      errors.push(issue('REGISTRY_PATH_ESCAPE', location, `Agent path is outside the repository: '${agent.file_path}'.`));
    } else if (!existsSync(agentAbsolute)) {
      errors.push(issue('REGISTRY_AGENT_MISSING', agent.file_path, 'Registered agent file does not exist.'));
    } else {
      const parsed = validateAgentText(readFileSync(agentAbsolute, 'utf8'), { path: agent.file_path });
      errors.push(...parsed.errors);
      if (parsed.data && parsed.data.name !== agent.name) {
        errors.push(issue('REGISTRY_NAME_MISMATCH', agent.file_path, `Registry name '${agent.name}' does not match frontmatter name '${parsed.data.name}'.`));
      }
    }

    if (agent.eval_path !== null) {
      const evalAbsolute = resolveContainedPath(root, agent.eval_path);
      if (!evalAbsolute) {
        errors.push(issue('REGISTRY_PATH_ESCAPE', location, `Eval path is outside the repository: '${agent.eval_path}'.`));
      } else if (!existsSync(evalAbsolute)) {
        errors.push(issue('REGISTRY_EVAL_MISSING', agent.eval_path, 'Registered eval file does not exist.'));
      }
    } else if (agent.id !== 'search-growth-orchestrator') {
      errors.push(issue('REGISTRY_EVAL_REQUIRED', location, 'Only the orchestrator may omit a dedicated eval in phase 1.'));
    }
  }

  for (const requiredId of REQUIRED_SEARCH_GROWTH_AGENT_IDS) {
    if (!byId.has(requiredId)) {
      errors.push(issue('REGISTRY_REQUIRED_AGENT_MISSING', REGISTRY_PATH, `Required Search Growth agent '${requiredId}' is missing.`));
    }
  }

  for (const agent of registry.agents) {
    if (!Array.isArray(agent?.handoff_targets)) continue;
    for (const target of agent.handoff_targets) {
      if (!byId.has(target)) {
        errors.push(issue('REGISTRY_UNKNOWN_HANDOFF', REGISTRY_PATH, `Agent '${agent.id}' references unknown handoff target '${target}'.`));
      }
      if (target === agent.id) {
        errors.push(issue('REGISTRY_SELF_HANDOFF', REGISTRY_PATH, `Agent '${agent.id}' cannot hand off to itself.`));
      }
    }
  }

  const orchestrator = byId.get('search-growth-orchestrator');
  if (orchestrator) {
    const requiredTargets = REQUIRED_SEARCH_GROWTH_AGENT_IDS.filter((id) => id !== orchestrator.id);
    for (const target of requiredTargets) {
      if (!orchestrator.handoff_targets.includes(target)) {
        errors.push(issue('ORCHESTRATOR_TARGET_MISSING', REGISTRY_PATH, `Orchestrator must reference '${target}'.`));
      }
    }
    const orchestratorPath = resolveContainedPath(root, orchestrator.file_path);
    if (orchestratorPath && existsSync(orchestratorPath)) {
      const text = readFileSync(orchestratorPath, 'utf8');
      for (const target of requiredTargets) {
        const targetAgent = byId.get(target);
        if (targetAgent && !text.includes(targetAgent.name)) {
          errors.push(issue('ORCHESTRATOR_REFERENCE_MISSING', orchestrator.file_path, `Orchestrator does not reference registered agent '${targetAgent.name}'.`));
        }
      }
    }
  }

  return errors;
}

export function validateSearchStackReferences(root) {
  const sourcePath = 'SEARCH-GROWTH-STACK.md';
  const absolute = join(root, sourcePath);
  if (!existsSync(absolute)) return [issue('SEARCH_STACK_MISSING', sourcePath, 'Search Growth stack index is missing.')];
  const text = readFileSync(absolute, 'utf8');
  const references = new Set([...text.matchAll(/`((?:[\w.-]+\/)+[\w.-]+\.md)`/g)].map((match) => match[1]));
  const errors = [];
  for (const reference of references) {
    const target = resolveContainedPath(root, reference);
    if (!target || !existsSync(target)) {
      errors.push(issue('SEARCH_STACK_REFERENCE_MISSING', sourcePath, `Referenced file does not exist: '${reference}'.`));
    }
  }
  return errors;
}

export function validateAgents(root) {
  const agents = loadAgents(root);
  const errors = agents.flatMap((agent) => agent.errors);
  errors.push(...validateRegistry(root));
  errors.push(...validateSearchStackReferences(root));
  return { agents, errors };
}
