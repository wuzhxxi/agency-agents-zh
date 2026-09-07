import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { validateCountAnchors } from "../../lib/search-growth/catalog.mjs";

function write(root, path, contents) {
  const target = join(root, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function agent(name) {
  return `---\nname: ${name}\ndescription: Test fixture agent\ncolor: blue\nemoji: 🧪\n---\n\n# ${name}\n`;
}

test("README agent-count validation does not hard-code the supported tool count", (t) => {
  const root = mkdtempSync(join(tmpdir(), "search-growth-tool-count-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  write(root, "marketing/alpha.md", agent("Alpha"));
  write(root, "marketing/beta.md", agent("Beta"));

  write(root, "README.md", `# Test\n\n> **2 个即插即用的 AI 专家角色**\n\n| 🤖 AI 智能体 | 🌏 英文版翻译 | 🇨🇳 中国市场原创 |\n|:---:|:---:|:---:|\n| **2** | **1** | **1** |\n\n手把手把这仓 2 位专家用成一支团队。\n\n| 本项目 | 专家角色库 | 2 个**即插即用** AI 专家 |\n\n**2 个 AI 专家角色，20 种工具支持，即装即用**\n`);

  write(root, "README.zh-TW.md", `# Test\n\n> **2 個即插即用的 AI 專家角色**\n\n| 🤖 AI 智能體 | 🌏 英文版翻譯 | 🇨🇳 中國市場原創 |\n|:---:|:---:|:---:|\n| **2** | **1** | **1** |\n\n搜尋 —— 全部 2 位，直接在瀏覽器裡看：\n`);

  write(root, "package.json", `${JSON.stringify({ description: "2 个即插即用的 AI 专家角色定义 — test" }, null, 2)}\n`);

  const result = validateCountAnchors(root);
  assert.deepEqual(result.errors, []);
});
