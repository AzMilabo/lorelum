# 官网部署工作流（Cloudflare Workers + Workers Builds）

> **适用范围**：`apps/site`（Lorelum 官网：Landing + Docs）。
> **线上地址**：https://lorelum.liruidongxyz.workers.dev
> **部署目标**：Cloudflare **Workers**（项目名 `lorelum`），Git 集成走 **Workers Builds**，手动部署走 `wrangler deploy` 直传。
> **更新日期**：2026-08-25

## 1. 部署形态（先搞清楚再动手）

`apps/site` 用官方 `@cloudflare/vite-plugin`（SSR Worker 模式）构建：

- `bun run build:site` 产出 `apps/site/dist/`（`dist/client` 静态资源 + `dist/server` Worker）
- `wrangler.jsonc` 的 `main` 指向 `@tanstack/react-start/server-entry`
- Cloudflare 后台项目类型是 **Worker**（不是 Pages），域名 `lorelum.liruidongxyz.workers.dev`

**常见误区**：Cloudflare Pages 免费版的"每月 500 次 build"限制**不适用于本项目**。本项目走 Workers Builds，配额按**构建分钟**计（见 §4）。

## 2. 两种上线方式

| 方式 | 命令 | 是否消耗 Workers Builds 配额 | 适用场景 |
|---|---|---|---|
| **Git 自动构建** | push 到 `main` | ✅ 消耗（Cloudflare 端跑构建） | 正式发布 |
| **手动直传** | 本地 build 后 `wrangler deploy` | ❌ 不消耗 | 日常迭代看线上效果 |

## 3. 日常迭代工作流（推荐，零配额消耗）

改版期间**不需要每次 push 触发构建**，全部在本地完成：

```bash
# 1) 本地开发（vite dev，含 Worker 运行时模拟）
bun install
bun run --filter @lorelum/site dev          # http://localhost:3000

# 2) 类型检查
bun run --filter @lorelum/site typecheck

# 3) 验证生产产物
bun run build:site                          # 产出 apps/site/dist
cd apps/site && bun run preview             # vite preview 预览产物
# 或验证 Worker 运行时：
cd apps/site && npx wrangler dev --port 8788

# 4) 想看线上效果 → 手动直传（不经过 Workers Builds，零配额）
bun run build:site && bun run deploy:site
```

手动直传会直接更新**生产**（`lorelum.liruidongxyz.workers.dev`），所以适合在站点本就是展示/测试用途时使用；若是正式站，改版预览请走本地（第 3 步）或临时 preview 版本。

## 4. 配额说明

- **Workers Free**：Workers Builds = **3,000 build 分钟/月**，1 个并发构建。
- **Workers Paid**（$5/月）：6,000 分钟/月，超出 $0.005/分钟，6 个并发。
- 一次 `bun install + vite build` 约 1–3 分钟 → 免费额度每月可支撑上千次 Git 自动构建，日常迭代走 §3 手动直传后几乎用不到。
- 本地 `wrangler deploy` 是**直接上传产物**，Cloudflare 端不跑构建，因此**不消耗 Workers Builds 分钟**。

## 5. Git 自动构建（Branch control）现状

后台 **Workers → `lorelum` → Settings → Build → Branch control**：

| 设置 | 当前值 | 说明 |
|---|---|---|
| Production branch | `main` | 只有 push 到 `main` 才触发生产构建 |
| Builds for non-production branches | **关闭** | push 到 `feat/*` 等分支不触发任何构建 |

> 这是 2026-08-25 调整后的状态：之前生产分支是 `feat/site-tanstack-fumadocs-spike` 且非生产分支构建开启，导致每次 push 都烧配额。现在 `feat/*` 随便 push 都不消耗。

### 何时改回/调整

- **正式发布**：直接 push `main` 即可（自动构建）。
- **需要某个分支的自动预览**：把 Production branch 指向该分支，或重新开启 "Builds for non-production branches"（会重新开始消耗配额）。
- **调整入口**：Cloudflare 后台 → Workers & Pages → `lorelum` → Settings → Build → Branch control。

## 6. 正式发布（Go Live）

```bash
# 在 feature 分支完成开发、验证后合并到 main
git checkout main && git merge feat/xxx
git push origin main        # Cloudflare Workers Builds 自动构建 + 部署
```

或者跳过 Git 构建，直接用本地产物发布：

```bash
bun run build:site && bun run deploy:site
```

## 7. 相关命令速查

（均在仓库根目录，见根 `package.json`）

| 命令 | 作用 |
|---|---|
| `bun run build:site` | 构建 `apps/site` → `apps/site/dist/` |
| `bun run deploy:site` | `cd apps/site && npx wrangler deploy`（手动直传生产） |
| `bun run versions:site` | `cd apps/site && npx wrangler versions upload`（Workers Builds 非生产分支用） |

## 8. 已知问题 / 排障

- **"Error fetching GitHub User or Organization details"**：后台 Build 设置页常驻警告，Cloudflare 拉取 GitHub 组织/用户信息失败，与本次部署无关，但若 push `main` 后未触发构建，优先检查 GitHub 侧 Cloudflare App 授权。
- **构建没触发**：确认分支是 `main`（非生产分支构建已关闭）；确认 GitHub 集成正常（Settings → Build → Git repository → Manage）。
- **配额查询**：Cloudflare 后台 → Workers plans，或 Workers & Pages → `lorelum` → Deployments（构建历史）。

## 关联

- `docs/research/tanstack-fumadocs-spike.md` — 技术选型 spike 结论
- `apps/site/README.md` — 站点开发说明
