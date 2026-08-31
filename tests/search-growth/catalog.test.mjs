import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { checkCatalog } from "../../lib/search-growth/catalog.mjs";

function write(root, path, contents) {
  const target = join(root, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function agent(name) {
  return `---
name: ${name}
description: Test fixture agent
color: blue
emoji: 🧪
---

# ${name}
`;
}

function validAgentList(count = 2) {
  return `# Agent List

> 记录项目中所有 ${count} 个 AI 智能体的完整信息。

AI 智能体：${count} 个

| Agent ID | 中文名 | 描述 | 来源 |
|---|---|---|---|
| \`alpha\` | Alpha | A | 测试 |
| \`beta\` | Beta | B | 测试 |

| **总计** | **${count}** | **100%** |
| **总计** | **${count}** | **100%** |
`;
}

function validReadme(count = 2) {
  return `# Test

> **${count} 个即插即用的 AI 专家角色**

| 🤖 AI 智能体 | 🌏 英文版翻译 | 🇨🇳 中国市场原创 |
|:---:|:---:|:---:|
| **${count}** | **1** | **1** |

手把手把这仓 ${count} 位专家用成一支团队。

| 本项目 | 专家角色库 | ${count} 个**即插即用** AI 专家 |

**${count} 个 AI 专家角色，18 种工具支持，即装即用**
`;
}

function validTraditionalReadme(count = 2) {
  return `# Test

> **${count} 個即插即用的 AI 專家角色**

| 🤖 AI 智能體 | 🌏 英文版翻譯 | 🇨🇳 中國市場原創 |
|:---:|:---:|:---:|
| **${count}** | **1** | **1** |

搜尋 —— 全部 ${count} 位，直接在瀏覽器裡看：
`;
}

function makeRepository(t) {
  const root = mkdtempSync(join(tmpdir(), "search-growth-catalog-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  write(root, "marketing/alpha.md", agent("Alpha"));
  write(root, "marketing/beta.md", agent("Beta"));
  write(
    root,
    "CATALOG.md",
    `# Catalog

## Marketing (2)

| 中文名 | 文件路径 |
|---|---|
| Alpha | \`marketing/alpha.md\` |
| Beta | \`marketing/beta.md\` |
`,
  );
  write(root, "AGENT-LIST.md", validAgentList());
  write(root, "README.md", validReadme());
  write(root, "README.zh-TW.md", validTraditionalReadme());
  write(
    root,
    "package.json",
    `${JSON.stringify({ description: "2 个即插即用的 AI 专家角色定义 — test" }, null, 2)}\n`,
  );
  return root;
}

test("checkCatalog accepts complete, unique, count-consistent indexes", (t) => {
  const root = makeRepository(t);
  const result = checkCatalog(root);

  assert.equal(result.agentCount, 2);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});
test("checkCatalog reports CATALOG path, duplicate, existence, and section failures", (t) => {
  const root = makeRepository(t);
  write(
    root,
    "CATALOG.md",
    `# Catalog

## Marketing (4)

| 中文名 | 文件路径 |
|---|---|
| Alpha | \`marketing/alpha.md\` |
| Alpha again | \`marketing/alpha.md\` |
| Ghost | \`marketing/ghost.md\` |
`,
  );

  const { errors } = checkCatalog(root);
  assert.ok(errors.some((error) => error.includes("duplicate path") && error.includes("alpha.md")));
  assert.ok(errors.some((error) => error.includes("missing agent path") && error.includes("beta.md")));
  assert.ok(errors.some((error) => error.includes("unexpected agent path") && error.includes("ghost.md")));
  assert.ok(errors.some((error) => error.includes("path does not exist") && error.includes("ghost.md")));
  assert.ok(errors.some((error) => error.includes("count is 4, but contains 3 rows")));
  assert.ok(errors.some((error) => error.includes('directory "marketing" has 2 agents')));
});

test("checkCatalog reports AGENT-LIST ID and total failures", (t) => {
  const root = makeRepository(t);
  const broken = validAgentList(99)
    .replace("| `beta` | Beta | B | 测试 |", "| `alpha` | Duplicate | A2 | 测试 |\n| `ghost` | Ghost | G | 测试 |");
  write(root, "AGENT-LIST.md", broken);

  const { errors } = checkCatalog(root);
  assert.ok(errors.some((error) => error.includes("duplicate Agent ID") && error.includes("alpha")));
  assert.ok(errors.some((error) => error.includes("missing Agent ID") && error.endsWith("beta")));
  assert.ok(errors.some((error) => error.includes("unexpected Agent ID") && error.endsWith("ghost")));
  assert.ok(errors.some((error) => error.includes("header total is 99")));
  assert.ok(errors.some((error) => error.includes("summary total is 99")));
});

test("checkCatalog reports README and package count-anchor drift", (t) => {
  const root = makeRepository(t);
  write(root, "README.md", validReadme(7));
  write(root, "README.zh-TW.md", validTraditionalReadme(8));
  write(
    root,
    "package.json",
    `${JSON.stringify({ description: "9 个即插即用的 AI 专家角色定义 — test" }, null, 2)}\n`,
  );

  const { errors } = checkCatalog(root);
  assert.ok(errors.some((error) => error.includes("[README.md]") && error.includes("is 7")));
  assert.ok(errors.some((error) => error.includes("[README.zh-TW.md]") && error.includes("is 8")));
  assert.ok(errors.some((error) => error.includes("[package.json]") && error.includes("is 9")));
});

test("checkCatalog fails closed when a known count anchor disappears", (t) => {
  const root = makeRepository(t);
  const readme = readFileSync(join(root, "README.md"), "utf8").replace(
    /\*\*2 个 AI 专家角色，18 种工具支持，即装即用\*\*/,
    "Agent collection",
  );
  write(root, "README.md", readme);

  const { errors } = checkCatalog(root);
  assert.ok(
    errors.some(
      (error) => error.includes("[README.md]") && error.includes("missing known closing total anchor"),
    ),
  );
});
