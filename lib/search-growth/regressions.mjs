import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const PERCENT = /(?:[+-]?\d+(?:\.\d+)?(?:\s*[-\u2013\u2014]\s*[+-]?\d+(?:\.\d+)?)?\s*%)/i;
const PRESCRIPTIVE = /(?:\u5fc5\u987b|\u5fc5\u9700|\u5e94\u8be5|\u5e94\u5f53|\u8981\u6c42|\u76ee\u6807|\u6700\u597d|\u6700\u4f73|\u81f3\u5c11|\u4e0d\u5f97\u8d85\u8fc7|\u63a7\u5236\u5728|\u8bbe\u4e3a|\u7edf\u4e00|\u56fa\u5b9a|\u6807\u51c6|\u9608\u503c|\bmust\b|\brequir(?:e|ed|ement)s?\b|\bshould\b|\bbest\b|\btarget\b|\bat\s+least\b|\bminimum\b|\bmaximum\b|\bset\s+to\b|\baim\s+for\b)/i;

const RULES = [
  {
    id: 'fixed-keyword-density',
    message: 'Do not prescribe a fixed keyword-density target.',
    matches(text) {
      if (!/(?:keyword\s*[- ]?density|\u5173\u952e\u8bcd\u5bc6\u5ea6)/i.test(text)) return false;
      return PERCENT.test(text) || PRESCRIPTIVE.test(text);
    },
  },
  {
    id: 'fixed-seo-word-count',
    message: 'Do not prescribe a fixed SEO article or page word count.',
    matches(text) {
      const hasContentSubject = /(?:seo|\u6587\u7ae0|\u535a\u5ba2|\u5185\u5bb9|\u9875\u9762|article|blog|content|page)/i.test(text);
      const hasWordCount = /(?:\u5b57\u6570|\u8bcd\u6570|\u5355\u8bcd\u6570|word\s*count|\d[\d,.]*\s*(?:\u5b57|\u8bcd|words?))/i.test(text);
      if (!hasContentSubject || !hasWordCount) return false;
      return PRESCRIPTIVE.test(text) || /\d[\d,.]*\s*(?:\u5b57|\u8bcd|words?)/i.test(text);
    },
  },
  {
    id: 'toxic-backlink-disavow-threshold',
    message: 'Do not trigger disavow automatically from a toxicity percentage.',
    matches(text) {
      const hasToxicity = /(?:toxic(?:ity)?(?:\s+(?:backlinks?|links?|score|percentage))?|\u6709\u6bd2(?:\u53cd\u5411\u94fe\u63a5|\u5916\u94fe|\u94fe\u63a5)|\u6709\u6bd2\u94fe\u63a5\u6bd4\u4f8b|\u6bd2\u6027(?:\u5206\u6570|\u6bd4\u4f8b)?)/i.test(text);
      if (!hasToxicity || !/\bdisavow\b/i.test(text)) return false;
      return PERCENT.test(text) || /(?:\u8d85\u8fc7|\u9ad8\u4e8e|\u8fbe\u5230|\u6bd4\u4f8b|\u9608\u503c|\u81ea\u52a8|\u76f4\u63a5|over|above|threshold|percentage|automatically|directly)/i.test(text);
    },
  },
  {
    id: 'fixed-ai-citation-uplift',
    message: 'Do not promise or prescribe a fixed AI citation uplift.',
    matches(text) {
      const hasCitationMetric = /(?:ai\s*(?:citation|mention|recommendation)|citation\s*rate|mention\s*rate|recommendation\s*rate|ai\s*\u5f15\u7528(?:\u7387)?|\u5f15\u7528\u7387|\u63d0\u53ca\u7387|\u63a8\u8350\u7387)/i.test(text);
      const hasUpliftClaim = /(?:uplift|lift|increase|improve|boost|guarantee|expected|\u63d0\u5347|\u63d0\u9ad8|\u589e\u957f|\u589e\u52a0|\u4fdd\u8bc1|\u9884\u8ba1|\u56fa\u5b9a|\u5fc5\u987b|\u76ee\u6807|\u8fbe\u5230)/i.test(text);
      if (!hasCitationMetric || !PERCENT.test(text) || !hasUpliftClaim) return false;
      return !/(?:`?provided`?|\u7528\u6237(?:\u9009\u62e9|\u8bbe\u5b9a|\u63d0\u4f9b)|\u5ba2\u6237(?:\u9009\u62e9|\u8bbe\u5b9a|\u63d0\u4f9b)|\u5185\u90e8\u76ee\u6807|client[- ]selected|customer[- ]provided|client\s+experiment\s+data|historical\s+experiment\s+data)/i.test(text);
    },
  },
  {
    id: 'fabricated-industry-citation-average',
    message: 'Do not state a numeric industry citation average as a universal fact.',
    matches(text) {
      const hasAverage = /(?:\u884c\u4e1a\u5e73\u5747|\u884c\u4e1a\u57fa\u51c6|industry\s+(?:average|benchmark)|citation\s+average)/i.test(text);
      const hasCitationMetric = /(?:ai\s*(?:citation|mention|recommendation)|citation(?:\s*(?:rate|average))?|\u5f15\u7528\u7387|\u63d0\u53ca\u7387|\u63a8\u8350\u7387)/i.test(text);
      return hasAverage && hasCitationMetric && PERCENT.test(text);
    },
  },
  {
    id: 'crawler-role-confusion',
    message: 'Keep training crawlers separate from search and user-triggered retrieval crawlers.',
    matches(text) {
      const wrongRelation = /(?:\u5fc5\u987b|\u5fc5\u9700|\u552f\u4e00|\u5c31\u662f|\u7b49\u540c|\u540c\u4e00|\u76f8\u540c|\u51b3\u5b9a|\u4f9d\u8d56|\u5141\u8bb8|\u5c4f\u853d|\u770b\u4e0d\u5230|\u8fdb\u4e0d\u4e86|\u641c\u7d22\u722c\u866b|\bmust\b|\brequired\b|\bonly\b|\bsame\b|\bequivalent\b|\ballow\b|\bblock\b|\bdepends?\b|\bsearch\s+(?:bot|crawler)\b)/i;
      const gptConfusion = /\bgptbot\b/i.test(text)
        && /(?:chatgpt\s*search|oai-searchbot)/i.test(text)
        && wrongRelation.test(text);
      const claudeConfusion = /\bclaudebot\b/i.test(text)
        && /(?:claude(?:\s*web)?\s*search|claude-searchbot|claude\s*\u641c\u7d22)/i.test(text)
        && wrongRelation.test(text);
      return gptConfusion || claudeConfusion;
    },
  },
  {
    id: 'google-extended-search-lever',
    message: 'Do not treat Google-Extended as a Google Search or AI Overview ranking/inclusion lever.',
    matches(text) {
      if (!/google-extended/i.test(text)) return false;
      const hasSearchSurface = /(?:google\s*search|ai\s*overview|ai\s*mode|search\s*(?:ranking|inclusion)|\u641c\u7d22(?:\u6392\u540d|\u6536\u5f55)|\u6392\u540d|\u6536\u5f55)/i.test(text);
      const hasLeverClaim = /(?:\u5f00\u5173|\u63d0\u9ad8|\u63d0\u5347|\u5f71\u54cd|\u51b3\u5b9a|\u5141\u8bb8|\u5c4f\u853d|\u5fc5\u987b|\u4fe1\u53f7|lever|control|boost|increase|affect|determine|allow|disallow|required|signal)/i.test(text);
      return hasSearchSurface && hasLeverClaim;
    },
  },
  {
    id: 'llms-txt-google-requirement',
    message: 'Do not present llms.txt as required for Google Search or Google AI Search.',
    matches(text) {
      if (!/\bllms\.txt\b/i.test(text)) return false;
      const hasGoogleSurface = /(?:google\s*(?:search|ai\s*search|ai\s*overview|ai\s*mode)|ai\s*overviews?|\u8c37\u6b4c(?:\u641c\u7d22)?)/i.test(text);
      const hasRequirement = /(?:\u5fc5\u987b|\u5fc5\u9700|\u5fc5\u9700\u9879|\u5fc5\u9700\u6587\u4ef6|\u524d\u7f6e|\u8981\u6c42|\u6392\u540d|\u6536\u5f55|\u63d0\u5347|\u63d0\u9ad8|\u53ef\u89c1\u6027|required|requirement|prerequisite|ranking|inclusion|boost|visibility)/i.test(text);
      return hasGoogleSurface && hasRequirement;
    },
  },
  {
    id: 'fixed-cross-platform-token-budget',
    message: 'Do not impose a fixed cross-platform page token budget.',
    matches(text) {
      if (!/\btokens?\b|token\s*budget/i.test(text)) return false;
      const hasNumericLimit = /(?:[<>]=?\s*)?\d[\d,.]*\s*(?:k\s*)?tokens?\b/i.test(text)
        || /\b\d+(?:\.\d+)?k\s+tokens?\b/i.test(text)
        || (/token\s*budget/i.test(text) && /\b\d+(?:\.\d+)?k\b/i.test(text));
      const hasHardRule = /(?:\u5fc5\u987b|\u5fc5\u9700|\u4e0d\u5f97\u8d85\u8fc7|\u4f4e\u4e8e|\u4e0a\u9650|\u5408\u89c4\u95e8\u69db|\u8de8\u5e73\u53f0\u4e8b\u5b9e|\u56fa\u5b9a(?:\u89c4\u5219|\u4e0a\u9650|\u8981\u6c42|\u95e8\u69db)|\u4e0d\u4f1a\u5f15\u7528|must|required|maximum|limit|hard\s+cap|across\s+platforms|will\s+not\s+cite)/i.test(text);
      const hasFixedScope = /(?:\u56fa\u5b9a|\u7edf\u4e00|\u8de8\u5e73\u53f0|all\s+platforms|across\s+platforms).{0,30}token(?:\s*budget)?|token\s*budget.{0,30}(?:\u56fa\u5b9a|\u7edf\u4e00|\u8de8\u5e73\u53f0|all\s+platforms|across\s+platforms)/i.test(text);
      return (hasNumericLimit && hasHardRule) || hasFixedScope;
    },
  },
  {
    id: 'legacy-webmcp-imperative-api',
    message: 'Do not recommend navigator.mcpActions.register() as the current WebMCP API.',
    matches(text) {
      return /navigator\s*\.\s*mcpActions\s*\.\s*register\s*\(/i.test(text);
    },
  },
  {
    id: 'legacy-webmcp-declarative-api',
    message: 'Do not recommend data-mcp-* attributes as the current declarative WebMCP API.',
    matches(text) {
      return /\bdata-mcp-(?:[a-z][a-z0-9-]*|\*)?/i.test(text);
    },
  },
  {
    id: 'legacy-webmcp-discovery-endpoint',
    message: 'Do not present /mcp-actions.json as a current universal WebMCP discovery endpoint.',
    matches(text) {
      if (!/\/mcp-actions\.json\b/i.test(text)) return false;
      return /(?:webmcp|\u5fc5\u987b|\u5fc5\u9700|\u901a\u7528|\u6807\u51c6|\u5f53\u524d|\u53d1\u73b0(?:\u7aef\u70b9)?|\u53d1\u5e03|\u5b9e\u73b0|required|must|universal|standard|current|discovery(?:\s+endpoint)?|publish|implement)/i.test(text);
    },
  },
];

const NEGATIVE_HEADING = /(?:\u7981\u6b62\u884c\u4e3a|\u9519\u8bef\u793a\u4f8b|\u4e0d\u518d\u4f7f\u7528(?:\u7684)?\u65e7\u6a21\u5f0f|\u56de\u5f52\u8bc4\u6d4b|legacy(?:\s+patterns?)?|regression(?:\s+guardrails?)?|critical\s+fail(?:ure)?s?|fail\s+conditions?)/i;
const NEGATIVE_INTRO = /(?:\u4f60\u4e0d\u5f97|\u7f16\u6392\u5668\u4e0d\u5f97|\u4e0d\u5f97(?:\u5199|\u4f7f\u7528\u4ee5\u4e0b)|\u9519\u8bef\u793a\u4f8b|\u4ee5\u4e0b.*(?:\u7981\u6b62|\u4e0d\u5f97|\u4e25\u91cd\u5931\u8d25)|\u9664\u975e.*\u4e0d\u5f97\u5efa\u8bae|the\s+following\s+(?:are\s+)?forbidden|critical\s+fail(?:ure)?s?|fail\s+conditions?)/i;
const POSITIVE_INTRO = /(?:\u6b63\u786e\u505a\u6cd5|\u5e94\u8be5\u5224\u65ad|\u63a8\u8350\u505a\u6cd5|\u53ef\u4f7f\u7528|correct\s+(?:approach|examples?)|instead)/i;
const EXPLICIT_REJECTION = /(?:\u4e0d\u5f97|\u7981\u6b62|\u4e0d\u5e94|\u4e0d\u80fd|\u4e0d\u8981|\u4e0d\u628a|\u4e0d\u4f7f\u7528|\u4e0d\u9700\u8981|\u4e0d\u8bbe|\u4e0d\u5b58\u5728|\u4e0d\u662f|\u5e76\u975e|\u4e0d\u7b49\u4e8e|\u4e0d\u4f1a|\u4e0d\u5f71\u54cd|\u4e0d\u627f\u8bfa|\u4e0d\u5efa\u8bae|\u62d2\u7edd|\u907f\u514d|\u533a\u5206|\u5206\u5f00|\u865a\u6784|\u6df7\u6dc6|\u8fc7\u65f6|\u5f03\u7528|\u672a\u9a8c\u8bc1|\u672a\u7ecf\u9a8c\u8bc1|\u65e0\u8bc1\u636e|\u9664\u975e|\u2260|\bmust\s+not\b|\bshould\s+not\b|\bdo(?:es)?\s+not\b|\bis\s+not\b|\bare\s+not\b|\bnot\s+(?:a\s+)?(?:requirement|required|standard|current)\b|\breject(?:s|ed|ing)?\b|\brefus(?:e|es|ed|ing)\b|\bavoid(?:s|ed|ing)?\b|\bdistinguish(?:es|ed|ing)?\b|\bseparat(?:e|es|ed|ing)\b|\bdeprecated\b|\bstale\b|\bincorrect\b|\bwrong\b|\bwithout\s+evidence\b|\bunless\b|\bneeds?\s+verification\b|\bmark(?:ed)?\s+as\s+legacy\b)/i;
const NEUTRAL_FRAMING = /(?:\u662f\u5426|\u7528\u4e8e\u68c0\u67e5|\u7528\u4e8e\u68c0\u6d4b|\u68c0\u67e5\u662f\u5426|\u8bc4\u4f30\u662f\u5426|\bwhether\b|\bcheck(?:s|ing)?\s+(?:for|whether)\b|\bdetect(?:s|ing)?\b|\baudit(?:s|ing)?\b)/i;

function normalizePath(path) {
  return String(path || '<text>').replaceAll('\\', '/');
}

function searchableText(text) {
  return text
    .normalize('NFKC')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNegativeHeading(headings) {
  return headings.some((heading) => NEGATIVE_HEADING.test(heading));
}

function fieldKind(label) {
  const normalized = label.toLowerCase();
  if (normalized === 'user') return 'user';
  if (normalized.startsWith('pass condition')) return 'pass';
  if (normalized.startsWith('fail condition')) return 'fail';
  if (normalized.startsWith('critical fail')) return 'critical';
  return null;
}

function isSuppressedContext({ field, headings, inheritedNegative }) {
  return field === 'user'
    || field === 'fail'
    || field === 'critical'
    || inheritedNegative
    || isNegativeHeading(headings);
}

function splitClauses(line) {
  return line
    .split(/[\u3002\uff01\uff1f\uff1b!?;]/)
    .map(searchableText)
    .filter(Boolean);
}

export function scanRegressionText(text, { path = '<text>' } = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('scanRegressionText(text) requires a string');
  }

  const displayPath = normalizePath(path);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headings = [];
  const violations = [];
  const seen = new Set();
  let field = null;
  let inheritedNegative = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      headings.length = level - 1;
      headings[level - 1] = searchableText(headingMatch[2]);
      field = null;
      inheritedNegative = false;
      continue;
    }

    if (/^(?:-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      field = null;
      inheritedNegative = false;
      continue;
    }

    const labelMatch = /^\s*\*\*(User|Pass conditions?|Fail conditions?|Critical fail(?:ure)?s?)\s*[:\uff1a]\*\*\s*(.*)$/i.exec(rawLine);
    if (labelMatch) {
      field = fieldKind(labelMatch[1]);
      inheritedNegative = false;
      if (!labelMatch[2].trim()) continue;
    }

    if (/^\s*(?:Critical fail(?:ure)?s?|\u4e25\u91cd\u5931\u8d25)\s*[:\uff1a]?\s*$/i.test(trimmed)
      || /^\s*\u4ee5\u4e0b\u4efb\u4e00\u60c5\u51b5\u89c6\u4e3a\u4e25\u91cd\u5931\u8d25\s*[:\uff1a]?\s*$/.test(trimmed)) {
      field = 'critical';
      inheritedNegative = true;
      continue;
    }

    if (POSITIVE_INTRO.test(trimmed)) inheritedNegative = false;
    if (NEGATIVE_INTRO.test(trimmed)) inheritedNegative = true;

    if (!trimmed || /^```|^~~~/.test(trimmed)) continue;

    const suppressed = isSuppressedContext({ field, headings, inheritedNegative });
    for (const clause of splitClauses(rawLine)) {
      if (suppressed || EXPLICIT_REJECTION.test(clause) || NEUTRAL_FRAMING.test(clause)) continue;

      for (const rule of RULES) {
        if (!rule.matches(clause)) continue;
        const key = `${rule.id}:${index + 1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({
          ruleId: rule.id,
          path: displayPath,
          line: index + 1,
          message: rule.message,
        });
      }
    }
  }

  return violations;
}

export function scanRegressionFiles(root, paths) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('scanRegressionFiles(root, paths) requires a root path');
  }
  if (paths == null || typeof paths[Symbol.iterator] !== 'function') {
    throw new TypeError('scanRegressionFiles(root, paths) requires an iterable of paths');
  }

  const rootPath = resolve(root);
  const violations = [];

  for (const inputPath of paths) {
    const absolutePath = isAbsolute(inputPath) ? inputPath : resolve(rootPath, inputPath);
    let displayPath = isAbsolute(inputPath) ? relative(rootPath, absolutePath) : inputPath;
    if (!displayPath || displayPath.startsWith('..')) displayPath = absolutePath;
    const text = readFileSync(absolutePath, 'utf8');
    violations.push(...scanRegressionText(text, { path: normalizePath(displayPath) }));
  }

  return violations.sort((a, b) => a.path.localeCompare(b.path)
    || a.line - b.line
    || a.ruleId.localeCompare(b.ruleId));
}
