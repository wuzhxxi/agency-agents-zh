import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  scanRegressionFiles,
  scanRegressionText,
} from '../../lib/search-growth/regressions.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const violationCases = [
  {
    name: 'fixed keyword density',
    ruleId: 'fixed-keyword-density',
    text: 'SEO 页面必须保持 2.5% 的关键词密度。',
  },
  {
    name: 'fixed SEO article word count',
    ruleId: 'fixed-seo-word-count',
    text: '每篇 SEO 文章必须至少 3000 字。',
  },
  {
    name: 'toxicity percentage automatically triggers disavow',
    ruleId: 'toxic-backlink-disavow-threshold',
    text: '有毒外链超过 5% 就自动 disavow。',
  },
  {
    name: 'fixed AI citation uplift',
    ruleId: 'fixed-ai-citation-uplift',
    text: '添加 FAQ Schema 保证 AI Citation Rate 提升 20%。',
  },
  {
    name: 'fabricated industry citation average',
    ruleId: 'fabricated-industry-citation-average',
    text: 'Industry Citation Average 是 42%。',
  },
  {
    name: 'GPTBot and OAI-SearchBot role confusion',
    ruleId: 'crawler-role-confusion',
    text: '必须允许 GPTBot 才能进入 ChatGPT Search。',
  },
  {
    name: 'ClaudeBot and Claude-SearchBot role confusion',
    ruleId: 'crawler-role-confusion',
    text: 'ClaudeBot 就是 Claude Search 的搜索爬虫。',
  },
  {
    name: 'Google-Extended as a Search ranking lever',
    ruleId: 'google-extended-search-lever',
    text: '允许 Google-Extended 会提高 Google AI Overview 排名。',
  },
  {
    name: 'llms.txt as a Google AI Search requirement',
    ruleId: 'llms-txt-google-requirement',
    text: 'llms.txt 是进入 Google AI Search 的必需文件。',
  },
  {
    name: 'fixed cross-platform token budget',
    ruleId: 'fixed-cross-platform-token-budget',
    text: '所有平台都采用固定 token budget。',
  },
  {
    name: 'legacy imperative WebMCP API',
    ruleId: 'legacy-webmcp-imperative-api',
    text: '当前 WebMCP 应使用 navigator.mcpActions.register({ name: "book" }) 注册工具。',
  },
  {
    name: 'legacy declarative WebMCP API',
    ruleId: 'legacy-webmcp-declarative-api',
    text: '当前标准声明式 API 是 data-mcp-* 属性。',
  },
  {
    name: 'legacy WebMCP discovery endpoint',
    ruleId: 'legacy-webmcp-discovery-endpoint',
    text: 'WebMCP 必须发布 /mcp-actions.json 作为通用发现端点。',
  },
];

test('detects every regression category with stable diagnostics', async (t) => {
  assert.equal(new Set(violationCases.map(({ ruleId }) => ruleId)).size, 12);

  for (const fixture of violationCases) {
    await t.test(fixture.name, () => {
      const violations = scanRegressionText(`前言\n\n${fixture.text}`, {
        path: 'fixtures/violation.md',
      });

      assert.deepEqual(violations.map(({ ruleId }) => ruleId), [fixture.ruleId]);
      assert.deepEqual(violations[0], {
        ruleId: fixture.ruleId,
        path: 'fixtures/violation.md',
        line: 3,
        message: violations[0].message,
      });
      assert.ok(violations[0].message.length > 0);
    });
  }
});

test('allows methodology prohibitions whose list items inherit negation', () => {
  const text = `# 禁止行为

你不得：

- 使用固定关键词密度作为优化目标
- 用字数作为 SEO 内容质量标准
- 用“有毒链接比例超过 5%”自动触发 disavow
- 声称 FAQ Schema 保证 AI Citation Rate 提升 20%
- 声称行业平均 AI Citation Rate 是 42%
- 把 GPTBot 说成 ChatGPT Search 必需 Bot
- 把 ClaudeBot 当作 Claude Search 的唯一爬虫
- 把 Google-Extended 说成 Google Search 排名开关
- 把 llms.txt 说成 Google AI Overview 必需文件
`;

  assert.deepEqual(scanRegressionText(text, { path: 'protected-agent.md' }), []);
});

test('allows explicit error examples and resumes scanning after a positive-context marker', () => {
  const text = `# 内容长度与 Token Budget

错误示例：

- 落地页必须 <8,000 tokens
- 博客必须 <12,000 tokens

正确做法：

- 根据用户意图决定内容长度
`;

  assert.deepEqual(scanRegressionText(text), []);
});

test('allows old WebMCP spellings inside a legacy section and code fence', () => {
  const text = `# 不再使用的旧模式

除非当前官方文档重新引入，否则不得建议以下旧模式：

\`\`\`text
navigator.mcpActions.register()
data-mcp-action
data-mcp-description
/mcp-actions.json
\`\`\`
`;

  assert.deepEqual(scanRegressionText(text), []);
});

test('allows legacy claims in eval User, Fail and Critical failure fields', () => {
  const text = `## Case 1 — Old imperative API

**User:**

“帮我用 navigator.mcpActions.register() 给页面接 WebMCP。”

**Pass conditions:**

- Does not use the old API.
- Distinguishes OAI-SearchBot from GPTBot.

**Fail conditions:**

- “超过 5% toxic backlinks 就自动 disavow.”

**Critical failure:**

- 把 data-mcp-* 当当前标准，并要求 /mcp-actions.json discovery endpoint。
`;

  assert.deepEqual(scanRegressionText(text, { path: 'eval.md' }), []);
});

test('allows explicit distinctions, rejections, optionality and neutral audit framing', () => {
  const text = `- GPTBot ≠ OAI-SearchBot。
- 必须区分 ClaudeBot、Claude-SearchBot 与 Claude-User。
- Google-Extended 不影响 Google Search 收录或排名。
- llms.txt 不是 Google AI Overview 必需项。
- 不使用固定关键词密度或固定文章字数。
- 不得依据 toxic backlink 5% 自动 disavow。
- 不承诺 AI Citation Rate 提升 20%。
- 固定 token budget 是否合理。
- 用户设定的 AI Citation Rate +20% 只能标记为 PROVIDED 内部目标。
`;

  assert.deepEqual(scanRegressionText(text), []);
});

test('does not mistake a regression checklist for affirmative guidance', () => {
  const text = `# 回归评测

重点防止：

- 固定 Citation uplift 20%
- 固定 token budget 8,000 tokens
- llms.txt 是 Google AI Overview 必需项
- navigator.mcpActions.register()
`;

  assert.deepEqual(scanRegressionText(text), []);
});

test('all protected methodology and eval sources remain clean', () => {
  const protectedPaths = [
    'marketing/marketing-aeo-foundations.md',
    'marketing/marketing-seo-specialist.md',
    'marketing/marketing-ai-citation-strategist.md',
    'marketing/marketing-agentic-search-optimizer.md',
    'marketing/marketing-search-growth-orchestrator.md',
    'SEARCH-GROWTH-STACK.md',
    'evals/marketing/seo-specialist-v2.md',
    'evals/marketing/ai-citation-strategist-v2.md',
    'evals/marketing/aeo-foundations-v2.md',
    'evals/marketing/agentic-search-optimizer-v2.md',
  ];

  assert.deepEqual(scanRegressionFiles(repositoryRoot, protectedPaths), []);
});

test('scanRegressionFiles reports normalized relative paths and line numbers', () => {
  const paths = ['tests/fixtures/regressions/file-scan-positive.md'];
  const violations = scanRegressionFiles(repositoryRoot, paths);

  assert.deepEqual(violations, [{
    ruleId: 'fixed-seo-word-count',
    path: 'tests/fixtures/regressions/file-scan-positive.md',
    line: 5,
    message: 'Do not prescribe a fixed SEO article or page word count.',
  }]);
});

test('validates API input types', () => {
  assert.throws(() => scanRegressionText(null), TypeError);
  assert.throws(() => scanRegressionFiles('', []), TypeError);
  assert.throws(() => scanRegressionFiles(repositoryRoot, null), TypeError);
});
