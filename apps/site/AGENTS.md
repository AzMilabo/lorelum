# AGENTS.md — apps/site

> Frontend-specific rules for AI coding agents working in this package. The
> [root AGENTS.md](../../AGENTS.md) still applies (strict TypeScript, typed
> errors, no silent failures, file organization, testing, git workflow). This
> file adds what is unique to a marketing/documentation frontend and wins on
> conflict inside `apps/site`.

## What this package is

The Lorelum landing + bilingual docs site: TanStack Start (SSR + prerender),
Fumadocs MDX, Tailwind v4 (CSS-first), React 19, GSAP, and vendored
[React Bits](https://reactbits.dev) components. Deployed to Cloudflare Workers
(see `docs/site-deploy.md`). It is the product's public face — visual quality
and performance are acceptance criteria, not polish.

## Commands

```bash
bun run --filter @lorelum/site dev        # vite dev → http://localhost:3000
bun run --filter @lorelum/site typecheck  # tsc --noEmit
bun run --filter @lorelum/site test       # bun test
bun run --filter @lorelum/site build      # static + Worker output in dist/
bun run lint                              # oxlint (repo root)
```

CI runs typecheck + lint + test on every PR. A PR that fails any of them is
not done.

## Where things go

| You are adding…                        | It goes in…                                        | Never…                                   |
| -------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| a landing section / page component     | `src/components/landing/`                          | —                                        |
| user-facing copy (any language)        | `src/lib/translations.ts`                          | hardcode strings in components           |
| animation capability check             | `src/components/landing/gates/` (+ colocated test) | inline `matchMedia` calls in components  |
| shared animation hook                  | `src/components/landing/hooks/`                    | a new top-level util file                |
| a vendored React Bits component        | `src/components/react-bits/` + barrel `index.ts`   | `npm install` an animation library       |
| third-party component CSS              | `src/styles/vendor.css`                            | inline `<style>` or new top-level CSS    |
| site's own CSS                         | `src/styles/landing.css`                           | edit `app.css` beyond `@theme` tokens    |
| SEO head / meta                        | `src/lib/meta.ts` + route `head`                   | `<title>` back into `__root.tsx`         |
| static assets                          | `public/`                                          | `src/` (imports are for code only)       |
| docs page                              | `content/docs/*.mdx` + `*.zh.mdx`                  | one locale without the other             |

`src/routeTree.gen.ts` is **generated** by TanStack Router. Never edit it; add
a file under `src/routes/` instead.

## Hard rules

These exist because breaking them caused real bugs here. Each names a file to
copy — read it before writing your own version.

1. **SSR safety.** The site server-renders and prerenders. No `window`,
   `document`, `matchMedia`, `localStorage` at module top level or during
   render — touch them inside `useEffect`/`useLayoutEffect` only. Copy:
   `src/components/landing/hero.tsx` (gates read in effects, refs for elements).

2. **GSAP lifecycle.** Import gsap and register plugins via
   `src/components/landing/gsap-client.ts` (`registerGsapPlugins()` before any
   ScrollTrigger/ScrollSmoother/SplitText use). Create tweens inside
   `gsap.context(() => {...})` and return `ctx.revert()` — never
   `gsap.matchMedia()` and never bare globals. Copy: `hero.tsx`,
   `src/components/landing/split-text-reveal.tsx`.

3. **ScrollTrigger, not IntersectionObserver.** `ScrollSmoother` breaks IO —
   observers never fire on this page. To run/pause work based on viewport,
   use `usePauseOffscreen` from `src/components/landing/hooks/use-viewport-anim.ts`.

4. **Canvas/WebGL effects are gated and single-layer.** New canvas, WebGL or
   per-frame effects must (a) render through a `motion-aware-*` wrapper in
   `landing/` that checks `shouldEnableCanvasEffects` from `gates/motion-gate`,
   (b) derive particle counts from `gates/particle-budget`, and (c) not add a
   second background layer — `page-background.tsx` is the one ambient layer.
   Three stacked glow layers already had to be deleted for flicker. Copy:
   `src/components/landing/motion-aware-specular-button.tsx`,
   `src/components/landing/antigravity.tsx` (SSR-safe Canvas usage).

5. **No `prefers-reduced-motion` machinery.** Product decision (recorded in
   commit `eec3b0e`): the site does not honor the OS reduce-motion setting.
   Gates branch on pointer type and hardware capability only. Do not re-add
   `matchMedia('(prefers-reduced-motion: …)')` or `motion-reduce:` classes.

6. **Bilingual or broken.** Every user-facing string goes through
   `LandingStrings` in `src/lib/translations.ts` with **both** the `en` and
   `zh` entries; typecheck fails on one-sided changes. Keep keys grouped by
   section with a comment, as the file already does.

7. **Vendored third-party code is ledgered.** React Bits components live in
   `src/components/react-bits/` with their license header, keep upstream
   structure, and are imported **only via the `@/components/react-bits`
   barrel**. Adding, removing or rewriting one requires a matching row in
   `apps/site/THIRD_PARTY_NOTICE.md`. Anything ported from elsewhere (e.g.
   `landing/antigravity.tsx` from antigravity.google) gets its own notice
   section with provenance and open license questions called out.

8. **Dark mode is class-based.** `dark:` is re-bound to `.dark` on `<html>`
   (`@custom-variant` in `app.css`), not `prefers-color-scheme`. Monochrome
   logo/mark assets invert under `html.dark` via `landing.css`; an asset that
   must keep brand color opts out with `.logo-keep-color`. Verify both themes
   before declaring done. Copy: `landing.css` logo-wall section.

9. **Check dependencies before adding them.** The repo is Apache-2.0 core —
   no GPL/AGPL deps without maintainer sign-off. Native-JS packages need
   matching `@types/*` (`three` → `@types/three`, pinned to the same minor —
   a stale local install once masked this and broke CI). Animation needs are
   already covered by `gsap`, `motion`, `ogl`, `three`; adding another
   animation library needs justification in the PR.

## Verification loop

- Logic (gates, hooks, lib) ships with colocated `*.test.ts` (`bun test`).
  Copy: `gates/particle-budget.test.ts`.
- Visual changes are verified in the dev server — both themes, both locales
  (`/en`, `/zh`) — before the PR is marked ready.
- Touching animation/perf? Check the FPS overlay in dev: append `?probe=1`
  (`fps-probe.tsx`, dev-only). A scroll that drops frames is not done.
- `bun run --filter @lorelum/site build` must pass before merging; it is also
  what Cloudflare runs.

## Deployment

Git-integrated Workers Builds deploys **`main` only**; feature branches don't
build. Details, quotas and manual `wrangler deploy` flow:
[`docs/site-deploy.md`](../../docs/site-deploy.md).

## When in doubt

Visual/UX questions are product decisions — ask, don't guess, and don't
"fix" unrelated visuals in passing. Git workflow (PRs, Conventional Commits,
issue links) follows the root AGENTS.md.
