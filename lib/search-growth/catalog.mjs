import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  extname,
  join,
  relative,
  resolve,
} from "node:path";

import { parseDocument } from "yaml";

export const AGENT_DIRECTORIES = Object.freeze([
  "academic",
  "company",
  "design",
  "engineering",
  "finance",
  "game-development",
  "gis",
  "hr",
  "legal",
  "marketing",
  "paid-media",
  "product",
  "project-management",
  "sales",
  "security",
  "spatial-computing",
  "specialized",
  "supply-chain",
  "support",
  "testing",
]);

const AGENT_LIST_TOTAL_ANCHORS = Object.freeze([
  {
    label: "header total",
    pattern: /记录项目中所有\s*(\d+)\s*个/g,
    minimumMatches: 1,
  },
  {
    label: "overview total",
    pattern: /AI 智能体：\s*(\d+)\s*个/g,
    minimumMatches: 1,
  },
  {
    label: "summary total",
    pattern: /^\|\s*\*\*总计\*\*\s*\|\s*\*\*(\d+)\*\*/gm,
    minimumMatches: 2,
  },
]);

const README_COUNT_ANCHORS = Object.freeze({
  "README.md": [
    {
      label: "hero total",
      pattern: /\*\*(\d+)\s*个即插即用的 AI 专家角色\*\*/g,
    },
    {
      label: "project scale total",
      pattern: /\|\s*🤖 AI 智能体[^\n]*\r?\n\|[^\n]*\r?\n\|\s*\*\*(\d+)\*\*/g,
    },
    {
      label: "course copy total",
      pattern: /这仓\s*(\d+)\s*位专家/g,
    },
    {
      label: "comparison table total",
      pattern: /\|\s*(\d+)\s*个\*\*即插即用\*\*\s*AI 专家/g,
    },
    {
      label: "closing total",
      pattern: /\*\*(\d+)\s*个 AI 专家角色，18 种工具支持，即装即用\*\*/g,
    },
  ],
  "README.zh-TW.md": [
    {
      label: "hero total",
      pattern: /\*\*(\d+)\s*個即插即用的 AI 專家角色\*\*/g,
    },
    {
      label: "project scale total",
      pattern: /\|\s*🤖 AI 智能體[^\n]*\r?\n\|[^\n]*\r?\n\|\s*\*\*(\d+)\*\*/g,
    },
    {
      label: "browser copy total",
      pattern: /全部\s*(\d+)\s*位，直接在瀏覽器裡看/g,
    },
  ],
});

function toPosix(path) {
  return path.replaceAll("\\", "/");
}
function walkMarkdown(directory) {
  const files = [];
  if (!existsSync(directory)) return files;

  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdown(path));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(path);
    }
  }
  return files;
}

function readAgentName(path) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("missing or unterminated YAML frontmatter");

  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }
  const metadata = document.toJS();
  if (!metadata || typeof metadata.name !== "string" || metadata.name.trim() === "") {
    throw new Error("frontmatter field 'name' must be a non-empty string");
  }
  return metadata.name.trim();
}

export function discoverAgents(root) {
  const rootDirectory = resolve(root);
  const agents = [];
  const errors = [];

  for (const directory of AGENT_DIRECTORIES) {
    for (const path of walkMarkdown(join(rootDirectory, directory))) {
      const relativePath = toPosix(relative(rootDirectory, path));
      try {
        agents.push({
          id: basename(path, extname(path)),
          name: readAgentName(path),
          path: relativePath,
          directory,
        });
      } catch (error) {
        errors.push(`[agents] ${relativePath}: ${error.message}`);
      }
    }
  }

  agents.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { agents, errors };
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "en"));
}

function compareExactSets(actualValues, documentedValues, labels) {
  const errors = [];
  const actual = new Set(actualValues);
  const documented = new Set(documentedValues);

  for (const value of [...actual].sort((a, b) => a.localeCompare(b, "en"))) {
    if (!documented.has(value)) errors.push(`${labels.missing}: ${value}`);
  }
  for (const value of [...documented].sort((a, b) => a.localeCompare(b, "en"))) {
    if (!actual.has(value)) errors.push(`${labels.unexpected}: ${value}`);
  }
  return errors;
}

function parseCatalogDocument(source) {
  const sections = [];
  const entries = [];
  const errors = [];
  let currentSection = null;

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const heading = line.match(/^##\s+(.+?)\s+\((\d+)\)\s*$/);
    if (heading) {
      currentSection = {
        title: heading[1].trim(),
        declaredCount: Number(heading[2]),
        line: index + 1,
        entries: [],
      };
      sections.push(currentSection);
      continue;
    }

    const row = line.match(/^\|\s*(.*?)\s*\|\s*`([^`]+\.md)`\s*\|\s*$/);
    if (!row) continue;

    const entry = {
      name: row[1].trim(),
      path: toPosix(row[2].replace(/^\.\//, "")),
      line: index + 1,
      section: currentSection,
    };
    entries.push(entry);
    if (currentSection) currentSection.entries.push(entry);
    else errors.push(`[CATALOG.md] line ${entry.line}: agent row is outside a counted section`);
  }

  return { sections, entries, errors };
}

export function validateCatalog(root, discovered = discoverAgents(root)) {
  const rootDirectory = resolve(root);
  const path = join(rootDirectory, "CATALOG.md");
  const errors = [...discovered.errors];
  if (!existsSync(path)) {
    return { ok: false, errors: [...errors, "[CATALOG.md] file is missing"] };
  }

  const parsed = parseCatalogDocument(readFileSync(path, "utf8"));
  errors.push(...parsed.errors);

  const documentedPaths = parsed.entries.map((entry) => entry.path);
  for (const duplicate of duplicateValues(documentedPaths)) {
    errors.push(`[CATALOG.md] duplicate path (${duplicate.count} rows): ${duplicate.value}`);
  }

  const actualPaths = discovered.agents.map((agent) => agent.path);
  errors.push(
    ...compareExactSets(actualPaths, documentedPaths, {
      missing: "[CATALOG.md] missing agent path",
      unexpected: "[CATALOG.md] unexpected agent path",
    }),
  );

  for (const entry of parsed.entries) {
    const absolutePath = join(rootDirectory, ...entry.path.split("/"));
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      errors.push(`[CATALOG.md] path does not exist (line ${entry.line}): ${entry.path}`);
    }
  }

  const discoveredByDirectory = new Map();
  for (const agent of discovered.agents) {
    discoveredByDirectory.set(
      agent.directory,
      (discoveredByDirectory.get(agent.directory) ?? 0) + 1,
    );
  }

  const sectionDirectories = new Map();
  for (const section of parsed.sections) {
    if (section.declaredCount !== section.entries.length) {
      errors.push(
        `[CATALOG.md] section "${section.title}" count is ${section.declaredCount}, but contains ${section.entries.length} rows`,
      );
    }

    const directories = new Set(section.entries.map((entry) => entry.path.split("/")[0]));
    if (directories.size !== 1) {
      errors.push(
        `[CATALOG.md] section "${section.title}" must contain exactly one agent directory`,
      );
      continue;
    }

    const [directory] = directories;
    if (sectionDirectories.has(directory)) {
      errors.push(
        `[CATALOG.md] directory "${directory}" appears in multiple sections: "${sectionDirectories.get(directory)}" and "${section.title}"`,
      );
    } else {
      sectionDirectories.set(directory, section.title);
    }

    if (discoveredByDirectory.has(directory)) {
      const actualCount = discoveredByDirectory.get(directory);
      if (section.declaredCount !== actualCount) {
        errors.push(
          `[CATALOG.md] section "${section.title}" count is ${section.declaredCount}, but directory "${directory}" has ${actualCount} agents`,
        );
      }
    }
  }

  for (const directory of [...discoveredByDirectory.keys()].sort((a, b) =>
    a.localeCompare(b, "en"),
  )) {
    if (!sectionDirectories.has(directory)) {
      errors.push(`[CATALOG.md] missing section for agent directory: ${directory}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function collectMatches(source, pattern) {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => Number(match[1]));
}

function validateAnchors(source, file, anchors, expectedCount) {
  const errors = [];
  for (const anchor of anchors) {
    const matches = collectMatches(source, anchor.pattern);
    const minimumMatches = anchor.minimumMatches ?? 1;
    if (matches.length < minimumMatches) {
      errors.push(
        `[${file}] missing known ${anchor.label} anchor (expected at least ${minimumMatches})`,
      );
      continue;
    }
    for (const value of matches) {
      if (value !== expectedCount) {
        errors.push(
          `[${file}] ${anchor.label} is ${value}, but discovered ${expectedCount} agents`,
        );
      }
    }
  }
  return errors;
}

export function validateAgentList(root, discovered = discoverAgents(root)) {
  const path = join(resolve(root), "AGENT-LIST.md");
  const errors = [...discovered.errors];
  if (!existsSync(path)) {
    return { ok: false, errors: [...errors, "[AGENT-LIST.md] file is missing"] };
  }

  const source = readFileSync(path, "utf8");
  const documentedIds = [...source.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map(
    (match) => match[1],
  );
  for (const duplicate of duplicateValues(documentedIds)) {
    errors.push(`[AGENT-LIST.md] duplicate Agent ID (${duplicate.count} rows): ${duplicate.value}`);
  }

  const actualIds = discovered.agents.map((agent) => agent.id);
  for (const duplicate of duplicateValues(actualIds)) {
    errors.push(
      `[agents] Agent ID is not unique (${duplicate.count} files share basename): ${duplicate.value}`,
    );
  }
  errors.push(
    ...compareExactSets(actualIds, documentedIds, {
      missing: "[AGENT-LIST.md] missing Agent ID",
      unexpected: "[AGENT-LIST.md] unexpected Agent ID",
    }),
    ...validateAnchors(
      source,
      "AGENT-LIST.md",
      AGENT_LIST_TOTAL_ANCHORS,
      discovered.agents.length,
    ),
  );

  return { ok: errors.length === 0, errors };
}

export function validateCountAnchors(root, discovered = discoverAgents(root)) {
  const rootDirectory = resolve(root);
  const errors = [...discovered.errors];
  const agentCount = discovered.agents.length;

  for (const [file, anchors] of Object.entries(README_COUNT_ANCHORS)) {
    const path = join(rootDirectory, file);
    if (!existsSync(path)) {
      errors.push(`[${file}] file is missing`);
      continue;
    }
    errors.push(...validateAnchors(readFileSync(path, "utf8"), file, anchors, agentCount));
  }

  const packagePath = join(rootDirectory, "package.json");
  if (!existsSync(packagePath)) {
    errors.push("[package.json] file is missing");
  } else {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      const match = packageJson.description?.match(/^(\d+)\s*个即插即用的 AI 专家角色定义/);
      if (!match) {
        errors.push("[package.json] missing known description count anchor");
      } else if (Number(match[1]) !== agentCount) {
        errors.push(
          `[package.json] description total is ${match[1]}, but discovered ${agentCount} agents`,
        );
      }
    } catch (error) {
      errors.push(`[package.json] invalid JSON: ${error.message}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function checkCatalog(root = process.cwd()) {
  const discovered = discoverAgents(root);
  const checks = [
    validateCatalog(root, discovered),
    validateAgentList(root, discovered),
    validateCountAnchors(root, discovered),
  ];
  return {
    agentCount: discovered.agents.length,
    errors: checks.flatMap((check) => check.errors),
    warnings: [],
  };
}
