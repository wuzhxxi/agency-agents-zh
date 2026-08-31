import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  discoverEvalFiles,
  loadEvalManifest,
  parseEvalMarkdown,
  validateEvals,
} from "../../lib/search-growth/evals.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const EXPECTED_FILES = [
  "evals/marketing/aeo-foundations-v2.md",
  "evals/marketing/agentic-search-optimizer-v2.md",
  "evals/marketing/ai-citation-strategist-v2.md",
  "evals/marketing/seo-specialist-v2.md",
];

const EXPECTED_CASES = new Map([
  ["evals/marketing/aeo-foundations-v2.md", 12],
  ["evals/marketing/agentic-search-optimizer-v2.md", 17],
  ["evals/marketing/ai-citation-strategist-v2.md", 14],
  ["evals/marketing/seo-specialist-v2.md", 8],
]);

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeFixture(t) {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "search-growth-evals-"));
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  mkdirSync(path.join(fixtureRoot, "evals", "marketing"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "search-growth"), { recursive: true });

  const evalPath = "evals/marketing/eval-one.md";
  const markdown = `# Fixture Eval

## Case 1 — Explicit critical

**User:**
Do a risky thing.

**Pass conditions:**
- Refuses the risky thing.

**Critical failure:**
- Performs the risky thing.

## Case 2 — Normal case

**User:** User request.

**Pass conditions:**
- Returns evidence.

## Scoring

Critical failures:
- Fabricates evidence.
`;
  writeFileSync(path.join(fixtureRoot, ...evalPath.split("/")), markdown, "utf8");

  const manifest = {
    version: 1,
    evaluations: [{
      id: "eval-one",
      agent_id: "agent-one",
      path: evalPath,
      evaluation_mode: "human_or_llm",
      status: "pending",
      expected_cases: 2,
      critical_case_ids: [1],
    }],
  };
  const registry = {
    version: 1,
    agents: [{ id: "agent-one", eval_path: evalPath }],
  };
  writeJson(path.join(fixtureRoot, "evals", "manifest.json"), manifest);
  writeJson(path.join(fixtureRoot, "search-growth", "registry.json"), registry);

  return { fixtureRoot, manifest, registry, evalPath };
}

function containsPassed(value) {
  if (typeof value === "string") return value.toLowerCase() === "passed";
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, "passed")) return true;
  return Object.values(value).some(containsPassed);
}

test("discovers the four repository eval files deterministically", () => {
  assert.deepEqual(discoverEvalFiles(ROOT), EXPECTED_FILES);
});

test("loads the pending-only manifest", () => {
  const manifest = loadEvalManifest(ROOT);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.evaluations.length, 4);
  assert.ok(manifest.evaluations.every((entry) => entry.status === "pending"));
  assert.ok(manifest.evaluations.every((entry) => !("passed" in entry)));
});

test("parses every repository case and critical-failure declarations", () => {
  let total = 0;
  for (const evalPath of EXPECTED_FILES) {
    const parsed = parseEvalMarkdown(
      readFileSync(path.join(ROOT, ...evalPath.split("/")), "utf8"),
      { path: evalPath },
    );
    assert.equal(parsed.caseCount, EXPECTED_CASES.get(evalPath), evalPath);
    assert.deepEqual(
      parsed.cases.map((evalCase) => evalCase.id),
      Array.from({ length: parsed.caseCount }, (_, index) => index + 1),
    );
    assert.ok(parsed.cases.every((evalCase) => evalCase.user), `${evalPath}: User fixture`);
    assert.ok(
      parsed.cases.every((evalCase) => evalCase.passConditions.length > 0),
      `${evalPath}: Pass conditions`,
    );
    assert.ok(
      parsed.explicitCriticalCaseIds.length > 0 || parsed.globalCriticalFailures.length > 0,
      `${evalPath}: critical failures`,
    );
    total += parsed.caseCount;
  }
  assert.equal(total, 51);
});

test("parses case-level and global critical failures separately", () => {
  const markdown = `# Eval

## Case 1 — Local critical
**User:** Request one.
**Pass conditions:**
- Safe response.
**Critical fail:**
- Unsafe response.

## Case 2 — Ordinary
**User:** Request two.
**Pass conditions:**
- Evidence-based response.

# Scoring
Critical failures：
- Fabricated evidence.
- Silent high-risk execution.
`;
  const parsed = parseEvalMarkdown(markdown, { path: "fixture.md" });
  assert.deepEqual(parsed.explicitCriticalCaseIds, [1]);
  assert.deepEqual(parsed.cases[0].criticalFailures, ["Unsafe response."]);
  assert.deepEqual(parsed.globalCriticalFailures, [
    "Fabricated evidence.",
    "Silent high-risk execution.",
  ]);
});

test("rejects duplicate case ids", () => {
  const markdown = `# Eval
## Case 1 — One
**User:** A
**Pass conditions:**
- A
## Case 1 — Duplicate
**User:** B
**Pass conditions:**
- B
`;
  assert.throws(
    () => parseEvalMarkdown(markdown, { path: "duplicate.md" }),
    /duplicate Case 1/u,
  );
});

test("validates repository coverage, mappings, counts, critical cases, and pending state", () => {
  const result = validateEvals(ROOT);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.evaluationCount, 4);
  assert.equal(result.totalCases, 51);
  assert.deepEqual(result.discoveredFiles, EXPECTED_FILES);
  assert.ok(result.evaluations.every((evaluation) => evaluation.status === "pending"));
  assert.ok(result.evaluations.every((evaluation) => (
    evaluation.cases.filter((evalCase) => evalCase.critical).length
      === evaluation.criticalCaseIds.length
  )));
  assert.equal(containsPassed(result), false);
});

test("reports invalid counts, critical ids, status, and registry mapping without producing pass results", (t) => {
  const { fixtureRoot, manifest, registry } = makeFixture(t);
  manifest.evaluations[0].expected_cases = 3;
  manifest.evaluations[0].critical_case_ids = [2, 1, 3];
  manifest.evaluations[0].status = "passed";
  registry.agents[0].eval_path = "evals/marketing/other.md";
  writeJson(path.join(fixtureRoot, "evals", "manifest.json"), manifest);
  writeJson(path.join(fixtureRoot, "search-growth", "registry.json"), registry);

  const result = validateEvals(fixtureRoot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /status must be "pending"/u);
  assert.match(result.errors.join("\n"), /expected_cases is 3, parsed 2/u);
  assert.match(result.errors.join("\n"), /critical_case_ids must be sorted ascending/u);
  assert.match(result.errors.join("\n"), /critical case id 3 does not exist/u);
  assert.match(result.errors.join("\n"), /registry eval_path/u);
  assert.equal(containsPassed(result.evaluations), false);
  assert.ok(result.evaluations.every((evaluation) => evaluation.status === "pending"));
});

test("requires exact manifest coverage for discovered Markdown", (t) => {
  const { fixtureRoot } = makeFixture(t);
  writeFileSync(
    path.join(fixtureRoot, "evals", "marketing", "orphan.md"),
    "# Orphan\n## Case 1 — Orphan\n",
    "utf8",
  );

  const result = validateEvals(fixtureRoot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /eval file is not declared in manifest: evals\/marketing\/orphan\.md/u);
});

test("accepts a minimal valid fixture and keeps its status pending", (t) => {
  const { fixtureRoot } = makeFixture(t);
  const result = validateEvals(fixtureRoot);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.evaluationCount, 1);
  assert.equal(result.totalCases, 2);
  assert.equal(result.evaluations[0].status, "pending");
  assert.deepEqual(result.evaluations[0].explicitCriticalCaseIds, [1]);
  assert.equal(containsPassed(result), false);
});
