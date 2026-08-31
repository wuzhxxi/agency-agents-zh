# Search Growth Engineering v1

本目录把现有 Search Growth Markdown Agent 包装成一个可维护、可验证的工程骨架。方法论仍以以下文件为准，工程代码只引用和校验它们，不复制完整 Prompt：

- `marketing/marketing-aeo-foundations.md`
- `marketing/marketing-seo-specialist.md`
- `marketing/marketing-ai-citation-strategist.md`
- `marketing/marketing-agentic-search-optimizer.md`
- `marketing/marketing-search-growth-orchestrator.md`
- `SEARCH-GROWTH-STACK.md`

## 架构与职责

Search Growth Stack 按依赖顺序分为四层：

1. AEO Foundations：负责 crawler、用户触发访问、训练抓取的边界，以及 robots、索引资格、WAF/CDN、渲染和日志证据。
2. SEO Specialist：负责 Google Search 的技术基础、需求与意图、内容架构、权威信号，以及自然搜索到业务结果的归因。
3. GEO / AI Search Visibility：负责 Prompt Universe、Mention、Recommendation、Owned/Earned Citation、Source Graph、AI Referral 与复测设计。
4. Agentic Task Completion：负责 Agent 到站后的真实任务、R0–R3 风险、工具选择、参数、执行、post-condition、确认、fallback 与安全事件。

Search Growth Orchestrator 只负责路由、去重、依赖、风险和统一 backlog。它不替专业 Agent 发明平台事实，也不会为了“全栈”而默认调用所有角色。

## Agent Registry

`search-growth/registry.json` 是五个核心 Agent 的机器可读索引。每条记录包含稳定 id、名称、源文件、简要职责、handoff targets、eval path 和状态，不复制 Prompt 正文。

Orchestrator 当前没有独立 Markdown eval，因此其 `eval_path` 明确为 `null`。这是 phase 1 的已知限制，而不是一个伪造的已通过评测。

## Shared Schemas

`search-growth/schemas/` 使用 JSON Schema Draft 2020-12 定义：

- `Evidence`
- `Finding`
- `BacklogItem`
- `PromptRun`
- `TaskRun`

字段名采用 JSON 友好的 snake_case；例如 `AEO impact` 表示为 `aeo_impact`，browser/version 与 agent/model 分别表示为 `browser`、`browser_version`、`agent`、`model`。结果允许显式 `UNKNOWN` 或 `null`，避免在未运行真实测试时伪造结果。

仓库已有 Node.js 脚本，因此 v1 沿用 Node 22，并只增加两个小型成熟依赖：`yaml` 用于真正解析 YAML frontmatter，`ajv` 用于编译和验证 JSON Schema。测试使用 Node 内置 `node:test`，没有引入应用框架。

## Lint 与 regression guardrails

Agent validator 会检查：

- YAML frontmatter 可解析且无重复 key
- `name`、`description`、`color`、`emoji` 为非空字符串
- Agent 正文存在
- Registry id/path 唯一，路径位于仓库内且文件存在
- eval path 存在（Orchestrator 的显式 `null` 例外）
- handoff target 与 Orchestrator 引用均指向已注册 Agent
- `SEARCH-GROWTH-STACK.md` 中的文件引用存在

Regression scanner 不使用全文关键词 grep。它组合“危险实体 + 错误关系/处方”，并理解 Markdown 标题、代码块、`禁止行为`、`错误示例`、legacy 段落以及 eval failure fixture 等负面上下文。因此，旧词汇可以作为禁止示例存在，但在正常实施建议中重新出现时会失败。

## Eval infrastructure

`evals/manifest.json` 显式映射四个专业 Agent 与现有 Markdown eval。Loader 会发现全部 eval、列出 case、解析 case-level 与 document-level critical failures，并验证 manifest、Registry 与文件的一致性。

Eval 文件是人工可读 fixture，不是运行结果。没有模型/API 时，状态始终为 `pending`；静态校验通过不等于 human/LLM eval passed。

## Catalog sync

`catalog check` 使用 Agent frontmatter 作为输入，检查：

- `CATALOG.md` 的路径完整性、重复项、失效项和章节数量
- `AGENT-LIST.md` 的 Agent ID 完整性、重复项和总数
- README、繁体 README 与 package 描述中的稳定数量锚点

README 与 `AGENT-LIST.md` 含人工策展、摘要和来源信息，当前没有安全的生成区边界，所以 v1 只提供 check mode，不自动重写这些文件。未来如需 write mode，应先加入明确的 `BEGIN/END GENERATED` 区块。

## CLI

在仓库根目录运行：

```bash
npm ci
npm run search-growth -- agents list
npm run search-growth -- agents validate
npm run search-growth -- schemas validate
npm run search-growth -- regressions check
npm run search-growth -- evals list
npm run search-growth -- evals validate
npm run search-growth -- catalog check
```

完整本地检查：

```bash
npm test
npm run validate:search-growth
```

## CI

`.github/workflows/search-growth-engineering.yml` 在指向 `main` 的相关 Pull Request 上使用 Node 22 和 lockfile 运行全部测试及静态校验。流程不访问第三方平台，不需要 secrets 或 API key。

## 未来增加 tool adapter

Phase 2 可以在 schema 与 Evidence 协议之上增加只读 adapter，例如 Search Console、Analytics、日志或平台 run importer。建议每个 adapter：

1. 声明稳定 adapter id、能力、输入边界与所需权限。
2. 默认禁用，由调用者显式注入凭据；凭据不得写入 Registry、fixture 或日志。
3. 输出共享 `Evidence` / `PromptRun` / `TaskRun`，保留来源、时间与原始 evidence reference。
4. 区分采集、分类与结论，不把 API 返回或单次观察自动判成 passed。
5. 先实现 read-only dry run，再单独评审任何有副作用的写操作。

本阶段没有接入 GSC、GA4、Ahrefs/Semrush、ChatGPT/Gemini/Claude/Perplexity，也没有添加客户数据、API key、邮件、CRM、购买、支付或预约自动化。
