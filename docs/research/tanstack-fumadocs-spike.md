# Spike 结论：TanStack Start + Fumadocs 技术验证

> **状态**：调研输入（非用户文档）。对应飞书任务 t100281「P0 网站 Spike：Astro + Fumadocs 技术验证」（已按 leader 要求切换为 TanStack Start）。
> **结论日期**：2026-08-18
> **范围**：最小可运行站点验证，不涉及正式视觉设计、Blog/CMS、多语言正式启用或 Pricing。

## TL;DR

**结论：推荐使用 TanStack Start + Fumadocs 作为 Lorelum 官网（Landing + Docs）技术栈。**

在最小可运行站点上，SSR/静态预渲染、React 水合交互、MDX、Shiki 代码高亮、静态搜索、中英双语路由、Cloudflare Pages 本地部署验证**全部实测通过**。Fumadocs 官方提供 TanStack Start 集成与 i18n 路由支持，核心功能无阻塞性风险。

> 注：本 spike 与之前的 Astro + Fumadocs 方案结论不同。Astro 方案（2026-08-17 验证）结论为「推荐 Astro」，但因 leader 明确要求改用 TanStack Start，本 spike 重新验证并**确认 TanStack Start 同样可行**。两个方案均通过验证，最终选型以团队决策为准。

## 验证矩阵

| 能力 | 子任务 | 结论 | 实测方式 |
|---|---|---|---|
| 最小可运行站点（Landing + Docs） | 1 | ✅ 通过 | `vite dev` / `vite build` 跑通，静态预渲染 7 页面 |
| React 水合交互 | 2 | ✅ 通过 | TerminalDemo 动画，headless Chromium 验证客户端推进 |
| MDX 内容渲染 | 3 | ✅ 通过 | Callout、Tabs、Steps、表格、代码块正确渲染，零 console 错误 |
| Shiki 代码高亮 | 3 | ✅ 通过 | TS 代码 5 种 token 颜色，语法级着色 |
| docs 静态搜索 | 3 | ✅ 通过 | 内置 ZBSearch，输入 "retrieval" 命中 "How retrieval works" |
| 中英双语 i18n 路由 | 4 | ✅ 通过 | `/en/docs` + `/zh/docs`，语言切换器跳转，中文 UI 本地化 |
| 静态托管部署（Cloudflare Pages） | 5 | ✅ 通过 | `@cloudflare/vite-plugin` + wrangler dev 本地验证全路由 200 |

## 关键实现要点

### 1. 站点结构（apps/site）

```text
apps/site/
├── content/docs/          # 用户文档（.mdx = en, .zh.mdx = zh）
├── src/
│   ├── components/        # mdx.tsx / not-found.tsx / terminal-demo.tsx / language-switch.tsx
│   ├── lib/
│   │   ├── i18n.ts        # defineI18n({ languages: ['en','zh'], defaultLanguage: 'en' })
│   │   ├── source.ts      # loader({ baseUrl: '/docs', i18n })
│   │   └── layout.shared.tsx  # baseOptions(locale)
│   ├── routes/
│   │   ├── $lang/         # /$lang (Landing), /$lang/docs/$ (Docs)
│   │   ├── api/search.ts  # ZBSearch server endpoint
│   │   └── ...
│   └── styles/
├── vite.config.ts         # @cloudflare/vite-plugin + tanstackStart(prerender)
└── wrangler.jsonc         # Cloudflare Pages 配置
```

### 2. 关键技术决策

- **路由**：Docs 用 `$lang` 嵌套路由（`/$lang/docs/$`），TanStack Router 文件系统路由。
- **内容多语言**：Fumadocs `defineI18n` + 文件后缀识别 locale（`index.zh.mdx` → zh），`loader` 传 `i18n`。
- **UI 本地化**：`@fumadocs/language/zh-cn` 语言包，`RootProvider i18n={i18nProvider(translations, lang)}`。
- **搜索**：Fumadocs 内置 ZBSearch（`createFromSource`），多语言模式零配置。
- **预渲染**：`tanstackStart({ prerender: { enabled: true } })`，crawler 从首页链接自动发现全部 7 页（含 zh）。**语言切换器链接是 crawler 发现 zh 页面的关键**。
- **部署**：**`@cloudflare/vite-plugin`**（非 nitro preset），产出 `dist/client`（静态）+ `dist/server`（Worker），`wrangler.jsonc` 的 `main` 指向 `@tanstack/react-start/server-entry`。
- **水合**：React 19 客户端水合，`TerminalDemo` 的 setInterval 仅在 hydrate 后运行。

### 3. 与 Astro 方案的差异

| 维度 | Astro + Fumadocs | TanStack Start + Fumadocs |
|---|---|---|
| 渲染模型 | 静态优先 + Islands | SSR + 静态预渲染（prerender）+ 客户端水合 |
| 交互 | `client:load` 指令按需水合 | React 全量水合（整个 app 一个 React 树） |
| i18n | `prefixDefaultLocale: false`（en 无前缀） | `$lang` 路由（所有语言带前缀） |
| 部署 | GitHub Pages（需 base 子路径） | Cloudflare Pages（无需 base，原生支持） |
| 搜索 | 内置 Orama | 内置 ZBSearch |

## 风险清单

| 风险 | 等级 | 说明 | 缓解 |
|---|---|---|---|
| React 全量水合体积 | 低 | 相比 Astro islands，TanStack 首屏 JS 更大（react-dom + router ~450KB gzip） | 官网 docs 场景可接受；后续可用代码分割 / 路由懒加载 |
| `nitro` cloudflare-pages preset 不可用 | 中 | nitro beta 的 cloudflare-pages preset 产物有 `No such module "react"` 问题 | **改用官方 `@cloudflare/vite-plugin`**，本 spike 已验证可靠 |
| 语言切换器需手写 | 低 | Fumadocs 的 `LanguageSelect` 需自行实现 onChange | 用简单 `Link` 切换（保留当前路径），本 spike 已实现 |
| wrangler 版本兼容 | 低 | 需 wrangler ≥ 4.74 支持 `@cloudflare/vite-plugin` | devDependency 已锁定 |
| prerender 覆盖不全 | 低 | crawler 只发现被链接的页面 | 语言切换链接 + landing 链接确保全部发现 |

## 选型建议

**推荐：使用 TanStack Start + Fumadocs**（在 leader 指定 TanStack Start 的前提下）。

理由：
1. **符合 leader 要求**：TanStack Start 是官方 React 全栈框架，与 React 生态一致。
2. **Fumadocs 官方支持**：提供 TanStack 适配器、集成示例和 i18n 路由文档。
3. **Cloudflare 部署成熟**：`@cloudflare/vite-plugin` 官方集成，无 base 负担、原生 PR 预览、免费无限带宽。
4. **搜索开箱即用**：内置 ZBSearch 多语言模式零配置。
5. **i18n 官方方案**：`$lang` 路由 + `defineI18n` + 语言包，官方文档完整。

对比替代方案：
- **Astro + Fumadocs**：静态优先、体积更小，但已按 leader 要求放弃。
- **Next.js + Fumadocs**：功能更强，但用户已明确排除（过重）。
- **VitePress**：轻量但 Landing 定制能力弱。

## 后续建议（不在本 spike 范围）

- 正式建站时：从 `apps/site` 出发，配置 CI（Cloudflare Pages Git 集成或 wrangler CLI 部署）。
- 若启用正式多语言，把 `docs/` 内容按 Getting Started / Concepts / CLI / MCP / Format 分层填充（定稿 IA）。
- 跟进 Fumadocs 对 TanStack 的 `LanguageSelect` 官方切换器支持，若上游补齐可移除手写切换。

## 关联

- Issue: AzMilabo/lorelum#1（P0 网站 Spike）
- 定稿：官网与文档站仓库结构 v1、产品定位与品牌、Lorelum 平台形态与部署模式 v1
