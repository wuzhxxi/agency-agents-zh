# Search Growth Stack — SEO / GEO / AEO / Agentic Search

本文件是 `agency-agents-zh` 中搜索增长与 Agentic Web 相关 Agent 的专用索引，用于快速选择正确角色并避免职责重叠。

> 核心原则：不要把 SEO、GEO、AEO 和 Agentic Web 混成一个“AI SEO”概念。它们共享技术、内容与转化基础，但目标、风险、测量口径和验证方法不同。

---

## 1. SEO 与自然搜索增长专家

文件：`marketing/marketing-seo-specialist.md`

### 负责

- Google Search 抓取与索引
- Technical SEO
- Search Demand / Keyword / Intent
- 内容架构与 Topic Cluster
- Internal Linking
- Structured Data 治理
- Authority / Digital PR 协同
- Google AI Overviews / AI Mode 的 Search 基础
- Search Console / GA4 / Lead / Revenue 归因

### 不负责

- 把 ChatGPT/Claude/Perplexity 单次回答当排名结果
- 保证 AI Citation
- 训练爬虫授权决策
- 浏览型 Agent 自动完成购买/预约任务

---

## 2. AI 搜索可见性与 GEO 策略师

文件：`marketing/marketing-ai-citation-strategist.md`

### 负责

- ChatGPT / Claude / Gemini/Google AI Search / Perplexity 可见性
- Prompt Universe / Prompt Family
- Prompt Provenance
- Mention Rate
- Recommendation Rate
- Owned Citation / Earned Citation
- Lost Prompt
- Source Graph
- Competitor AI Share of Voice
- 多次独立 Run 与 snapshot / stable measurement 区分
- AI Referral / Conversion

### 不负责

- 把 Schema 当固定 Citation 因果
- 虚构行业 Citation benchmark
- 用单次截图宣称 GEO 成功/失败
- 把训练 Bot 与 Search Bot 混为一谈
- 把 AI Citation 等同于 Agentic Task Completion

---

## 3. AEO 基础架构师

文件：`marketing/marketing-aeo-foundations.md`

### 负责

- Search / User-triggered / Training crawler 边界
- robots.txt
- noindex / canonical / HTTP status
- WAF / CDN / Bot Management
- JavaScript / Renderability / Parseability
- crawler logs
- OpenAI / Anthropic / Perplexity / Google 的访问策略核查
- 可选 discovery assets 的平台支持验证

### 特别规则

- `llms.txt` 不是 Google Search / AI Overview 必需项
- 不设跨平台固定 token budget
- 不默认所有 AI Bot 全部 Allow
- `GPTBot` ≠ `OAI-SearchBot`
- `ClaudeBot` ≠ `Claude-SearchBot`
- `Google-Extended` ≠ Google Search 排名开关

---

## 4. 智能体任务完成优化师

文件：`marketing/marketing-agentic-search-optimizer.md`

### 目标

关注用户授权 AI 浏览型 Agent 到站后，是否能**安全、正确、可重复地完成真实业务任务**，例如：

- 查询库存/订单
- 填表
- 注册
- 预约
- 加购
- 创建订单
- 购买/结账（高风险动作必须保留确认与权限边界）

### 负责

- Task Universe / Business Task Definition
- Task Risk Tier（R0–R3）
- Semantic HTML / Accessibility baseline
- WebMCP 适用性判断
- Declarative / Imperative WebMCP 设计（仅在当前平台支持时）
- Tool Selection Accuracy
- Parameter Accuracy
- Execution Success
- Post-condition Accuracy
- End-to-End Completion
- Human Confirmation
- Fallback Completion
- Safety Incident tracking
- Agent / Browser / Model compatibility testing
- Task-level business attribution

### 当前 WebMCP 护栏

WebMCP 仍是快速变化的 proposed / experimental web standard。执行前必须核对当前浏览器官方文档。

当前项目快照只作为待复核基线：

- Chrome 当前实现以 `document.modelContext` 为核心
- 命令式工具当前使用 `document.modelContext.registerTool(...)`
- 声明式工具当前基于标准 `<form>` 注解，例如 `toolname` / `tooldescription` / `toolparamdescription`
- `navigator.mcpActions.register()` 与旧 `data-mcp-*` 写法不得直接当当前标准
- 不把 `/mcp-actions.json` 当 WebMCP 必需发现端点
- 不从 Chrome 支持自动推断 Edge / Safari / Firefox / ChatGPT / Claude / Perplexity 支持
- WebMCP 应作为 progressive enhancement，不替代普通 UI、语义 HTML 与 Accessibility

### 与 SEO/GEO 的区别

- SEO：用户/搜索系统能否找到页面
- GEO：AI 回答是否提及、推荐、引用品牌
- Agentic：用户授权 Agent 到站后，是否能安全完成任务并产生真实业务状态

---

## 5. 搜索增长编排器

文件：`marketing/marketing-search-growth-orchestrator.md`

### 负责

根据任务自动判断：

- AEO-only
- SEO-only
- GEO-only
- Agentic-only
- AEO + SEO
- AEO + GEO
- SEO + GEO
- Search Everywhere
- 全栈：AEO + SEO + GEO + Agentic

并统一：

- Evidence State
- Business Impact
- Risk / Safety（Agentic 场景）
- Confidence
- Effort
- Dependencies
- Validation
- 90-day backlog
- Lead / Revenue attribution

推荐把它作为大型客户项目的入口 Agent。

---

# 推荐调用路径

## 网站完全没做过搜索增长

```text
AEO Foundations
      ↓
SEO Specialist
      ↓
GEO Strategist
      ↓
Search Growth Orchestrator
      ↓
Measurement / Iteration
```

只有客户存在真实的“AI Agent 到站完成任务”需求时，再启用 Agentic Search。

## 已有成熟 SEO，想进入 AI Search

```text
AEO quick audit
      ↓
GEO baseline
      ↓
Lost Prompt + Source Graph
      ↓
SEO/GEO shared fix pack
      ↓
Recheck + AI referral attribution
```

## 已有 AI Referral，想让 Agent 完成任务

```text
GEO / Referral baseline
      ↓
Agentic Task Universe
      ↓
Risk classification
      ↓
Semantic HTML / Accessibility baseline
      ↓
WebMCP capability check (if applicable)
      ↓
Controlled task eval
      ↓
Business + Safety attribution
```

## B2B SaaS / 企业服务

```text
Search Growth Orchestrator
      ├── SEO: commercial demand + comparison/use-case pages
      ├── GEO: recommendation prompts + third-party sources
      ├── AEO: crawler/access verification
      └── Agentic: demo booking / lead form / account task completion（如有真实需求）
```

## 电商

```text
SEO: product/category/search demand
GEO: product recommendation / comparison prompts
AEO: crawler + product content accessibility
Agentic: product lookup / cart / checkout task completion + high-risk confirmation
```

---

# 统一证据等级

整个 Search Growth Stack 优先使用：

- `VERIFIED`
- `PROVIDED`
- `OBSERVED`
- `INFERRED`
- `HYPOTHESIS`
- `UNKNOWN`

任何 Agent 都不得把 `INFERRED` / `HYPOTHESIS` / `UNKNOWN` 写成确定事实。

Agentic 场景还必须保留：

- Browser / version
- Agent / model
- Auth state
- Task set
- Risk tier
- Run ID
- Post-condition evidence

---

# 商业化交付建议

可以把这套 Agent 包装成四类客户产品：

### Search Foundation Audit

AEO + Technical SEO

检查：crawler、robots、indexability、WAF/CDN、网站结构和测量基础。

### AI Search Visibility Audit

GEO + SEO

检查：Prompt visibility、Mention、Recommendation、Citation、Source Graph、Lost Prompt 和竞争品牌。

### Agentic Task Audit

Agentic Search + AEO quick check

检查：真实任务、WebMCP/Agent 支持、任务完成、失败点、确认、安全、fallback 与业务 post-condition。

### Search Everywhere Retainer

Orchestrator + SEO + GEO + AEO + Authority + Analytics；只有业务需要时加入 Agentic。

持续执行：

- Technical fixes
- Content strategy
- AI visibility measurement
- Digital PR / authority
- Agentic task optimization（如适用）
- Conversion / revenue attribution
- Safety / failure recheck
- Monthly recheck

---

# 回归评测

相关 eval：

- `evals/marketing/seo-specialist-v2.md`
- `evals/marketing/ai-citation-strategist-v2.md`
- `evals/marketing/aeo-foundations-v2.md`
- `evals/marketing/agentic-search-optimizer-v2.md`

在修改这些 Agent 的核心规则后，应重新检查对应 eval，重点防止：

- 私有数据幻觉
- 平台 crawler 混淆
- Schema 因果神话
- 固定 Citation uplift
- 固定 token budget
- llms.txt 必需论
- 单次 AI 回答当稳定指标
- 旧 WebMCP API 重新出现
- 跨浏览器支持过度外推
- Tool count / Coverage 当业务 KPI
- 高风险动作静默自动执行
- Tool success 不验证真实 post-condition
- same-model self-grading
- 时间先后被误写成因果
