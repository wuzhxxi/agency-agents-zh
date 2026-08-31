import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

const CASE_HEADING = /^##\s+Case\s+(\d+)\s*(?:[—–-]\s*(.*?))?\s*$/iu;
const SECTION_HEADING = /^(#{1,6})\s+(.+?)\s*$/u;
const CASE_BOUNDARY_HEADING = /^#{1,2}\s+/u;
const BLOCK_LABEL = /^\s*\*\*(User|Pass conditions|Fail conditions|Critical fail(?:ure)?s?):\*\*\s*(.*?)\s*$/iu;
const CRITICAL_TEXT = /critical\s+fail(?:ure)?s?|严重失败|嚴重失敗/iu;
const SCORING_HEADING = /^(?:scoring|评分|評分)$/iu;
const CRITICAL_HEADING = /critical\s+fail(?:ure)?s?|严重失败|嚴重失敗/iu;

function asRoot(root) {
  return path.resolve(root ?? process.cwd());
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function cleanMarkdownLine(line) {
  return line
    .replace(/\s{2,}$/u, "")
    .replace(/^\s*>\s?/u, "")
    .trim();
}

function appendCondition(target, line) {
  const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*$/u);
  if (bullet) {
    target.push(cleanMarkdownLine(bullet[1]));
    return;
  }

  const value = cleanMarkdownLine(line);
  if (!value || /^(?:---+|```.*)$/u.test(value)) return;

  if (target.length === 0) {
    target.push(value);
  } else {
    target[target.length - 1] = `${target[target.length - 1]} ${value}`;
  }
}

function appendGlobalFailure(target, line) {
  const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*$/u);
  const value = cleanMarkdownLine(bullet ? bullet[1] : line);
  if (!value || /^(?:---+|```.*)$/u.test(value) || (!bullet && /[:：]$/u.test(value))) return;
  target.push(value);
}

function parseCase(lines, start, end, id, title, sourcePath) {
  const userLines = [];
  const passConditions = [];
  const failConditions = [];
  const criticalFailures = [];
  let activeBlock = null;

  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    const label = line.match(BLOCK_LABEL);
    if (label) {
      const normalized = label[1].toLowerCase();
      if (normalized === "user") activeBlock = "user";
      else if (normalized === "pass conditions") activeBlock = "pass";
      else if (normalized === "fail conditions") activeBlock = "fail";
      else activeBlock = "critical";

      if (label[2]) {
        if (activeBlock === "user") userLines.push(cleanMarkdownLine(label[2]));
        else if (activeBlock === "pass") appendCondition(passConditions, label[2]);
        else if (activeBlock === "fail") appendCondition(failConditions, label[2]);
        else appendCondition(criticalFailures, label[2]);
      }
      continue;
    }

    if (activeBlock === "user") {
      const value = cleanMarkdownLine(line);
      if (value && value !== "---") userLines.push(value);
    } else if (activeBlock === "pass") {
      appendCondition(passConditions, line);
    } else if (activeBlock === "fail") {
      appendCondition(failConditions, line);
    } else if (activeBlock === "critical") {
      appendCondition(criticalFailures, line);
    }
  }

  return {
    id,
    title,
    line: start + 1,
    user: userLines.join("\n") || null,
    passConditions,
    failConditions,
    criticalFailures,
    hasExplicitCriticalFailure: criticalFailures.length > 0,
    path: sourcePath,
  };
}

function parseGlobalCriticalFailures(lines, caseRanges) {
  const insideCase = new Set();
  for (const [start, end] of caseRanges) {
    for (let index = start; index < end; index += 1) insideCase.add(index);
  }

  const failures = [];
  let section = null;
  let scoringCapture = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (insideCase.has(index)) continue;

    const line = lines[index];
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      const headingText = cleanMarkdownLine(heading[2]);
      if (CRITICAL_HEADING.test(headingText)) section = "critical";
      else if (SCORING_HEADING.test(headingText)) section = "scoring";
      else section = null;
      scoringCapture = false;
      continue;
    }

    const value = cleanMarkdownLine(line);
    if (!value || value === "---") continue;

    if (section === "critical") {
      appendGlobalFailure(failures, line);
      continue;
    }

    if (section !== "scoring") continue;

    if (CRITICAL_TEXT.test(value)) {
      scoringCapture = true;
      if (!/^critical\s+fail(?:ure)?s?\s*[:：]?$/iu.test(value)) {
        appendGlobalFailure(failures, line);
      }
      continue;
    }

    if (scoringCapture) appendGlobalFailure(failures, line);
  }

  return [...new Set(failures)];
}

/**
 * Parse a human-readable Markdown eval without assigning an evaluation result.
 * Critical cases declared only in the manifest are intentionally not inferred
 * here; this parser reports explicit per-case markers and global failure rules.
 */
export function parseEvalMarkdown(text, { path: sourcePath = "<memory>" } = {}) {
  if (typeof text !== "string") {
    throw new TypeError(`${sourcePath}: eval Markdown must be a string`);
  }

  const lines = stripBom(text).replace(/\r\n?/gu, "\n").split("\n");
  const titleLine = lines.find((line) => /^#\s+\S/u.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/u, "").trim() : null;
  const caseHeadings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(CASE_HEADING);
    if (!match) continue;
    caseHeadings.push({
      start: index,
      id: Number(match[1]),
      title: match[2]?.trim() || `Case ${match[1]}`,
    });
  }

  if (caseHeadings.length === 0) {
    throw new Error(`${sourcePath}: no eval cases found`);
  }

  const seenIds = new Set();
  const cases = [];
  const caseRanges = [];

  for (const caseHeading of caseHeadings) {
    if (seenIds.has(caseHeading.id)) {
      throw new Error(`${sourcePath}: duplicate Case ${caseHeading.id}`);
    }
    seenIds.add(caseHeading.id);

    let end = lines.length;
    for (let index = caseHeading.start + 1; index < lines.length; index += 1) {
      if (CASE_BOUNDARY_HEADING.test(lines[index])) {
        end = index;
        break;
      }
    }

    caseRanges.push([caseHeading.start, end]);
    cases.push(parseCase(
      lines,
      caseHeading.start,
      end,
      caseHeading.id,
      caseHeading.title,
      sourcePath,
    ));
  }

  return {
    path: sourcePath,
    title,
    cases,
    caseCount: cases.length,
    explicitCriticalCaseIds: cases
      .filter((evalCase) => evalCase.hasExplicitCriticalFailure)
      .map((evalCase) => evalCase.id),
    globalCriticalFailures: parseGlobalCriticalFailures(lines, caseRanges),
  };
}

function readJson(jsonPath, label) {
  let text;
  try {
    text = readFileSync(jsonPath, "utf8");
  } catch (error) {
    throw new Error(`${label} could not be read at ${jsonPath}: ${error.message}`);
  }

  try {
    return JSON.parse(stripBom(text));
  } catch (error) {
    throw new Error(`${label} is not valid JSON at ${jsonPath}: ${error.message}`);
  }
}

export function loadEvalManifest(root) {
  return readJson(path.join(asRoot(root), "evals", "manifest.json"), "eval manifest");
}

export function discoverEvalFiles(root) {
  const rootDir = asRoot(root);
  const evalDir = path.join(rootDir, "evals");
  if (!existsSync(evalDir)) return [];

  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(toPosix(path.relative(rootDir, absolutePath)));
      }
    }
  };

  walk(evalDir);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function canonicalManifestPath(rootDir, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) return null;
  if (relativePath.includes("\\") || path.posix.isAbsolute(relativePath)) return null;
  const normalized = path.posix.normalize(relativePath);
  if (normalized !== relativePath || normalized === ".." || normalized.startsWith("../")) return null;

  const absolutePath = path.resolve(rootDir, ...relativePath.split("/"));
  const relativeToRoot = path.relative(rootDir, absolutePath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return { relativePath, absolutePath };
}

function addDuplicateErrors(values, label, errors) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) errors.push(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function validateCaseShape(parsed, evalPath, errors) {
  const expectedIds = Array.from({ length: parsed.cases.length }, (_, index) => index + 1);
  const actualIds = parsed.cases.map((evalCase) => evalCase.id);
  if (actualIds.some((id, index) => id !== expectedIds[index])) {
    errors.push(`${evalPath}: case ids must be sequential from 1; found [${actualIds.join(", ")}]`);
  }

  for (const evalCase of parsed.cases) {
    if (!evalCase.user) errors.push(`${evalPath}: Case ${evalCase.id} is missing a User fixture`);
    if (evalCase.passConditions.length === 0) {
      errors.push(`${evalPath}: Case ${evalCase.id} is missing Pass conditions`);
    }
  }
}

/**
 * Validate eval discovery, manifest integrity, registry mapping, and Markdown
 * structure. This function reports only static validation; it never marks an
 * eval or case as passed.
 */
export function validateEvals(root) {
  const rootDir = asRoot(root);
  const errors = [];
  const warnings = [];
  const discoveredFiles = discoverEvalFiles(rootDir);
  let manifest = null;
  let registry = null;

  try {
    manifest = loadEvalManifest(rootDir);
  } catch (error) {
    errors.push(error.message);
  }

  try {
    registry = readJson(
      path.join(rootDir, "search-growth", "registry.json"),
      "agent registry",
    );
  } catch (error) {
    errors.push(error.message);
  }

  const manifestEntries = Array.isArray(manifest?.evaluations) ? manifest.evaluations : [];
  if (manifest && manifest.version !== 1) errors.push(`eval manifest version must be 1; received ${manifest.version}`);
  if (manifest && !Array.isArray(manifest.evaluations)) errors.push("eval manifest evaluations must be an array");

  const registryAgents = Array.isArray(registry?.agents) ? registry.agents : [];
  if (registry && !Array.isArray(registry.agents)) errors.push("agent registry agents must be an array");
  const agentsById = new Map();
  for (const agent of registryAgents) {
    if (typeof agent?.id !== "string") continue;
    if (agentsById.has(agent.id)) errors.push(`duplicate registry agent id: ${agent.id}`);
    agentsById.set(agent.id, agent);
  }

  addDuplicateErrors(
    manifestEntries.filter((entry) => typeof entry?.id === "string").map((entry) => entry.id),
    "eval id",
    errors,
  );
  addDuplicateErrors(
    manifestEntries.filter((entry) => typeof entry?.path === "string").map((entry) => entry.path),
    "eval path",
    errors,
  );
  addDuplicateErrors(
    manifestEntries.filter((entry) => typeof entry?.agent_id === "string").map((entry) => entry.agent_id),
    "eval agent mapping",
    errors,
  );

  const declaredPaths = new Set(
    manifestEntries
      .filter((entry) => typeof entry?.path === "string")
      .map((entry) => entry.path),
  );
  const discoveredSet = new Set(discoveredFiles);
  for (const evalPath of discoveredFiles) {
    if (!declaredPaths.has(evalPath)) errors.push(`eval file is not declared in manifest: ${evalPath}`);
  }
  for (const evalPath of declaredPaths) {
    if (!discoveredSet.has(evalPath)) errors.push(`manifest eval path does not exist: ${evalPath}`);
  }

  const evaluations = [];
  let totalCases = 0;

  for (const entry of manifestEntries) {
    const label = typeof entry?.id === "string" ? entry.id : "<missing-id>";
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("eval manifest entries must be objects");
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) errors.push("eval entry id must be a non-empty string");
    if (typeof entry.agent_id !== "string" || entry.agent_id.length === 0) {
      errors.push(`${label}: agent_id must be a non-empty string`);
    }
    if (entry.evaluation_mode !== "human_or_llm") {
      errors.push(`${label}: evaluation_mode must be "human_or_llm"`);
    }
    if (entry.status !== "pending") {
      errors.push(`${label}: status must be "pending"; received ${JSON.stringify(entry.status)}`);
    }
    if (Object.hasOwn(entry, "passed")) errors.push(`${label}: a static eval manifest must not contain "passed"`);
    if (!Number.isInteger(entry.expected_cases) || entry.expected_cases < 1) {
      errors.push(`${label}: expected_cases must be a positive integer`);
    }
    if (!Array.isArray(entry.critical_case_ids)) {
      errors.push(`${label}: critical_case_ids must be an array`);
    }

    const manifestPath = canonicalManifestPath(rootDir, entry.path);
    if (!manifestPath || !entry.path.startsWith("evals/") || !entry.path.endsWith(".md")) {
      errors.push(`${label}: path must be a canonical repository-relative eval Markdown path`);
      continue;
    }

    const expectedId = path.posix.basename(entry.path, ".md");
    if (entry.id !== expectedId) errors.push(`${label}: id must match eval filename stem ${expectedId}`);

    const agent = agentsById.get(entry.agent_id);
    if (!agent) {
      errors.push(`${label}: agent_id is not present in registry: ${entry.agent_id}`);
    } else if (agent.eval_path !== entry.path) {
      errors.push(`${label}: registry eval_path for ${entry.agent_id} must equal ${entry.path}`);
    }

    if (!existsSync(manifestPath.absolutePath)) continue;

    let parsed;
    try {
      parsed = parseEvalMarkdown(readFileSync(manifestPath.absolutePath, "utf8"), { path: entry.path });
    } catch (error) {
      errors.push(error.message);
      continue;
    }

    validateCaseShape(parsed, entry.path, errors);
    totalCases += parsed.caseCount;
    if (Number.isInteger(entry.expected_cases) && parsed.caseCount !== entry.expected_cases) {
      errors.push(`${label}: expected_cases is ${entry.expected_cases}, parsed ${parsed.caseCount}`);
    }

    const caseIds = new Set(parsed.cases.map((evalCase) => evalCase.id));
    const criticalCaseIds = Array.isArray(entry.critical_case_ids) ? entry.critical_case_ids : [];
    const seenCriticalIds = new Set();
    let previousCriticalId = 0;
    for (const caseId of criticalCaseIds) {
      if (!Number.isInteger(caseId) || caseId < 1) {
        errors.push(`${label}: critical_case_ids must contain positive integers`);
        continue;
      }
      if (seenCriticalIds.has(caseId)) errors.push(`${label}: duplicate critical case id ${caseId}`);
      if (caseId < previousCriticalId) errors.push(`${label}: critical_case_ids must be sorted ascending`);
      if (!caseIds.has(caseId)) errors.push(`${label}: critical case id ${caseId} does not exist`);
      seenCriticalIds.add(caseId);
      previousCriticalId = caseId;
    }

    for (const explicitId of parsed.explicitCriticalCaseIds) {
      if (!seenCriticalIds.has(explicitId)) {
        errors.push(`${label}: explicitly critical Case ${explicitId} is missing from critical_case_ids`);
      }
    }
    if (criticalCaseIds.length > 0
        && parsed.explicitCriticalCaseIds.length === 0
        && parsed.globalCriticalFailures.length === 0) {
      errors.push(`${label}: critical_case_ids are declared but Markdown contains no critical failure rules`);
    }

    evaluations.push({
      id: entry.id,
      agentId: entry.agent_id,
      path: entry.path,
      evaluationMode: entry.evaluation_mode,
      // Static infrastructure may only report pending work. Even an invalid
      // manifest value is never reflected as an evaluation result.
      status: "pending",
      expectedCases: entry.expected_cases,
      criticalCaseIds: [...criticalCaseIds],
      title: parsed.title,
      cases: parsed.cases.map((evalCase) => ({
        ...evalCase,
        critical: seenCriticalIds.has(evalCase.id),
      })),
      explicitCriticalCaseIds: [...parsed.explicitCriticalCaseIds],
      globalCriticalFailures: [...parsed.globalCriticalFailures],
    });
  }

  const manifestByAgent = new Map(
    manifestEntries
      .filter((entry) => typeof entry?.agent_id === "string")
      .map((entry) => [entry.agent_id, entry.path]),
  );
  for (const agent of registryAgents) {
    if (agent?.eval_path == null) continue;
    if (manifestByAgent.get(agent.id) !== agent.eval_path) {
      errors.push(`registry eval is not mapped exactly once in manifest: ${agent.id} -> ${agent.eval_path}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    manifestVersion: manifest?.version ?? null,
    discoveredFiles,
    evaluationCount: evaluations.length,
    totalCases,
    evaluations,
  };
}
