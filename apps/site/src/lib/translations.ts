/**
 * Lightweight string dictionaries for the landing page and shared UI.
 *
 * Fumadocs localizes its own built-in UI (search trigger, TOC, etc.) via
 * the language packs wired in `__root.tsx`. This module covers the strings
 * we author ourselves (landing hero, terminal demo, 404, nav title).
 *
 * Keep the shape flat: one key per string, one object per locale.
 */

export interface LandingStrings {
  tagline: string;
  readDocs: string;
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
  notFoundTitle: string;
  notFoundDescription: string;
  backHome: string;
  switchTo: string;
}

const en: LandingStrings = {
  tagline: 'The right engineering Practice for the right AI coding task and moment.',
  readDocs: 'Read the docs',
  terminalCaption:
    'A client-hydrated terminal demo — the query loop runs only after React hydrates.',
  terminalWindowTitle: 'lore — interactive',
  terminalRetrieving: 'retrieving Practices…',
  terminalQuery: '$ lore query',
  terminalTaskPrompt: 'task: building the RBAC admin panel',
  terminalTask: 'moment: about to claim the whole capability is done',
  terminalPracticesPrompt: '3 relevant Practices',
  terminalPracticesText: 'verification.match-claims-to-evidence',
  terminalAntiPrompt: '2 anti-patterns',
  terminalAntiText: 'testing.tests-as-cheerleaders-for-implementation',
  notFoundTitle: 'Page Not Found',
  notFoundDescription:
    'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
  backHome: 'Back to Home',
  switchTo: 'Switch language to',
};

const zh: LandingStrings = {
  tagline: '在正确的任务与关键时刻，为 AI 编码智能体检索正确的工程 Practice。',
  readDocs: '阅读文档',
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
