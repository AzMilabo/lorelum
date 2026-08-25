/**
 * Lightweight string dictionaries for the landing page and shared UI.
 *
 * Fumadocs localizes its own built-in UI (search trigger, TOC, etc.) via
 * the language packs wired in `__root.tsx`. This module covers the strings
 * we author ourselves (landing hero, sections, terminal demo, 404, nav title).
 *
 * Keep the shape flat: one key per string, one object per locale. The
 * `translations.test.ts` guards that `en` and `zh` stay in lockstep.
 */

export interface LandingStrings {
  tagline: string;
  readDocs: string;
  // Hero
  heroBadge: string;
  heroTitleBefore: string;
  heroTitleGradient: string;
  heroTitleAfter: string;
  heroSub: string;
  ctaDocs: string;
  ctaGithub: string;
  // Terminal showcase
  terminalSectionTitle: string;
  terminalSectionSub: string;
  terminalCaption: string;
  terminalWindowTitle: string;
  terminalRetrieving: string;
  terminalQuery: string;
  terminalTaskPrompt: string;
  terminalTask: string;
  terminalPracticesPrompt: string;
  terminalPracticesText: string;
  terminalAntiPrompt: string;
  terminalAntiText: string;
  // Problem
  problemEyebrow: string;
  problemHeading: string;
  problemSub: string;
  problem1Title: string;
  problem1Body: string;
  problem2Title: string;
  problem2Body: string;
  problem3Title: string;
  problem3Body: string;
  // Features
  featuresEyebrow: string;
  featuresHeading: string;
  featuresSub: string;
  feature1Title: string;
  feature1Body: string;
  feature2Title: string;
  feature2Body: string;
  feature3Title: string;
  feature3Body: string;
  feature4Title: string;
  feature4Body: string;
  // Stats
  statsEyebrow: string;
  statsHeading: string;
  stats1Label: string;
  stats2Label: string;
  stats3Label: string;
  // Ecosystem
  ecosystemEyebrow: string;
  ecosystemHeading: string;
  ecosystemSub: string;
  ecosystemItems: string[];
  // CTA + footer
  ctaHeading: string;
  ctaSub: string;
  footerDocs: string;
  footerGithub: string;
  footerDiscussions: string;
  footerLicense: string;
  notFoundTitle: string;
  notFoundDescription: string;
  backHome: string;
  switchTo: string;
}

const en: LandingStrings = {
  tagline: 'The right engineering Practice for the right AI coding task and moment.',
  readDocs: 'Read the docs',
  // Hero
  heroBadge: 'Engineering knowledge, injected on demand',
  heroTitleBefore: 'The right ',
  heroTitleGradient: 'Practice',
  heroTitleAfter: ', at the right moment.',
  heroSub:
    'Lorelum retrieves your team\u2019s engineering Practices and injects them into AI context exactly when they\u2019re needed \u2014 so agents follow your rules, not drift from them.',
  ctaDocs: 'Read the docs',
  ctaGithub: 'Star on GitHub',
  // Terminal showcase
  terminalSectionTitle: 'See lore in action',
  terminalSectionSub:
    'A client-hydrated terminal demo \u2014 the query loop runs only after React hydrates.',
  terminalCaption:
    'A client-hydrated terminal demo \u2014 the query loop runs only after React hydrates.',
  terminalWindowTitle: 'lore — interactive',
  terminalRetrieving: 'retrieving Practices…',
  terminalQuery: '$ lore query',
  terminalTaskPrompt: 'task: building the RBAC admin panel',
  terminalTask: 'moment: about to claim the whole capability is done',
  terminalPracticesPrompt: '3 relevant Practices',
  terminalPracticesText: 'verification.match-claims-to-evidence',
  terminalAntiPrompt: '2 anti-patterns',
  terminalAntiText: 'testing.tests-as-cheerleaders-for-implementation',
  // Problem
  problemEyebrow: 'The problem',
  problemHeading: "Rules that don't reach the agent don't exist.",
  problemSub:
    'Your AGENTS.md may be perfectly written \u2014 and still never make it into the context that matters.',
  problem1Title: 'Rules drift at scale',
  problem1Body:
    'Frontier models comply with only ~68% of a 500-rule ruleset \u2014 every rule you add makes every other rule less likely to be followed.',
  problem2Title: 'Compaction eats context',
  problem2Body:
    'Long sessions trigger context compaction, and your early AGENTS.md falls out of the window \u2014 along with the requirements and evidence it encoded.',
  problem3Title: 'No signal until it\u2019s wrong',
  problem3Body:
    'There\u2019s no warning when the agent drifts \u2014 you only find out at review time, after the damage is done.',
  // Features
  featuresEyebrow: 'Why Lorelum',
  featuresHeading: 'Built for the moment of truth',
  featuresSub:
    'Structured engineering knowledge, retrieved and injected at the instant it matters.',
  feature1Title: 'Practices, not prompts',
  feature1Body:
    'Structured, retrievable engineering guidelines \u2014 the rules your team already believes in, made machine-readable.',
  feature2Title: 'Injected on demand',
  feature2Body:
    'Practices reach the agent exactly when a relevant task is happening \u2014 not dumped once at session start.',
  feature3Title: 'Local-first MCP + CLI',
  feature3Body:
    'A local MCP server and the lore CLI keep your knowledge on your machine, available to any agent.',
  feature4Title: 'Open format & packs',
  feature4Body:
    'A public Practice/pack spec and shareable knowledge packs \u2014 Apache-2.0, no lock-in.',
  // Stats
  statsEyebrow: 'By the numbers',
  statsHeading: 'Lorelum at a glance',
  stats1Label: 'public spec',
  stats2Label: 'ways to use \u2014 CLI + MCP',
  stats3Label: 'open source (Apache-2.0)',
  // Ecosystem
  ecosystemEyebrow: 'Ecosystem',
  ecosystemHeading: 'Works where your agents live',
  ecosystemSub:
    'One source of truth for the rules your coding agents are already reading.',
  ecosystemItems: [
    'AGENTS.md',
    'CLAUDE.md',
    '.cursorrules',
    'Cursor',
    'Claude Code',
    'Codex',
    'Continue',
    'Aider',
  ],
  // CTA + footer
  ctaHeading: 'Stop hoping your rules survive the session.',
  ctaSub: 'Give your agents the right Practice at the right moment.',
  footerDocs: 'Docs',
  footerGithub: 'GitHub',
  footerDiscussions: 'Discussions',
  footerLicense: 'Apache-2.0',
  notFoundTitle: 'Page Not Found',
  notFoundDescription:
    'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
  backHome: 'Back to Home',
  switchTo: 'Switch language to',
};

const zh: LandingStrings = {
  tagline: '在正确的任务与关键时刻，为 AI 编码智能体检索正确的工程 Practice。',
  readDocs: '阅读文档',
  // Hero
  heroBadge: '按需注入的工程知识',
  heroTitleBefore: '正确的 ',
  heroTitleGradient: 'Practice',
  heroTitleAfter: '，出现在正确的时刻。',
  heroSub:
    'Lorelum 在智能体最需要的时刻，把团队沉淀的工程 Practice 注入它的上下文——让 AI 遵循你的规则，而不是渐渐偏离。',
  ctaDocs: '阅读文档',
  ctaGithub: 'GitHub Star',
  // Terminal showcase
  terminalSectionTitle: '看看 lore 怎么工作',
  terminalSectionSub: '客户端水合终端演示 —— 查询循环仅在 React 水合后运行。',
  terminalCaption: '客户端水合终端演示 —— 查询循环仅在 React 水合后运行。',
  terminalWindowTitle: 'lore — 交互演示',
  terminalRetrieving: '正在检索 Practices…',
  terminalQuery: '$ lore query',
  terminalTaskPrompt: '任务：正在实现 RBAC 管理后台',
  terminalTask: '时刻：准备宣布整个能力已完成',
  terminalPracticesPrompt: '3 条相关 Practices',
  terminalPracticesText: 'verification.match-claims-to-evidence',
  terminalAntiPrompt: '2 条反模式',
  terminalAntiText: 'testing.tests-as-cheerleaders-for-implementation',
  // Problem
  problemEyebrow: '问题',
  problemHeading: '到不了智能体手里的规则，等于不存在。',
  problemSub: '你的 AGENTS.md 可能写得无可挑剔——却始终进不了真正重要的上下文。',
  problem1Title: '规则越多，越不被遵守',
  problem1Body:
    '前沿模型对 500 条规则集只有约 68% 的遵循率——每新增一条规则，都会降低其他规则被遵循的概率。',
  problem2Title: '上下文压缩吃掉规则',
  problem2Body:
    '长会话会触发上下文压缩，你早期的 AGENTS.md 连同其中的需求与证据一起被挤出窗口。',
  problem3Title: '等到发现时，已经错了',
  problem3Body: '智能体偏离时没有任何预警——等你审查代码时才发现，而伤害已经造成。',
  // Features
  featuresEyebrow: '为什么选择 Lorelum',
  featuresHeading: '为关键时刻而生',
  featuresSub: '结构化的工程知识，在最重要的瞬间被检索并注入。',
  feature1Title: '是 Practice，不是提示词',
  feature1Body: '结构化、可检索的工程准则——把你团队本来就在坚持的规则，变成机器可读的格式。',
  feature2Title: '按需注入',
  feature2Body: '在与任务相关的时刻精确注入，而不是在会话开始时就一次性倾倒。',
  feature3Title: '本地优先的 MCP + CLI',
  feature3Body: '本地 MCP 服务器与 lore CLI 让知识留在你的机器上，随时可供任意智能体使用。',
  feature4Title: '开放格式与知识包',
  feature4Body: '公开的 Practice/pack 规范与可共享的知识包——Apache-2.0，无锁定。',
  // Stats
  statsEyebrow: '数据一览',
  statsHeading: 'Lorelum 一览',
  stats1Label: '份公开规范',
  stats2Label: '种使用方式 —— CLI + MCP',
  stats3Label: '开源（Apache-2.0）',
  // Ecosystem
  ecosystemEyebrow: '生态',
  ecosystemHeading: '在你智能体所在之处工作',
  ecosystemSub: '为你的编码智能体正在阅读的规则，提供唯一的事实来源。',
  ecosystemItems: [
    'AGENTS.md',
    'CLAUDE.md',
    '.cursorrules',
    'Cursor',
    'Claude Code',
    'Codex',
    'Continue',
    'Aider',
  ],
  // CTA + footer
  ctaHeading: '别再把规则交给运气。',
  ctaSub: '在正确的时刻，把正确的 Practice 交给你的智能体。',
  footerDocs: '文档',
  footerGithub: 'GitHub',
  footerDiscussions: '讨论',
  footerLicense: 'Apache-2.0',
  notFoundTitle: '页面未找到',
  notFoundDescription: '您访问的页面可能已被移除、改名，或暂时不可用。',
  backHome: '返回首页',
  switchTo: '切换语言到',
};

const dictionaries: Record<string, LandingStrings> = { en, zh };

/** Resolve a locale to its dictionary, falling back to English. */
export function getStrings(locale: string): LandingStrings {
  return dictionaries[locale] ?? en;
}


