# Lorelum site (TanStack Start + Fumadocs)

Landing + Docs site built with [TanStack Start](https://tanstack.com/start) and
[Fumadocs](https://fumadocs.dev). Part of the P0 website spike
([#1](https://github.com/AzMilabo/lorelum/issues/1)).

## Development

```bash
bun install
bun run --filter @lorelum/site dev        # http://localhost:3000
bun run --filter @lorelum/site typecheck  # tsc --noEmit
bun run --filter @lorelum/site build      # static + Cloudflare Worker output in dist/
```

## Routes

- `/` — landing (default English), with a client-hydrated terminal demo
- `/en` / `/zh` — per-locale landing
- `/en/docs` / `/zh/docs` — bilingual docs (en: `content/docs/*.mdx`, zh: `*.zh.mdx`)
- `/llms.txt`, `/llms-full.txt` — LLM-friendly content export
- `/api/search` — built-in ZBSearch endpoint

Content is wired to Fumadocs via `src/lib/source.ts`; i18n config lives in
`src/lib/i18n.ts`.

## Deployment (Cloudflare Pages)

The site builds with the official `@cloudflare/vite-plugin` (SSR Worker
mode). `wrangler.jsonc` points `main` at `@tanstack/react-start/server-entry`.

Local verification:

```bash
bun run --filter @lorelum/site build
cd apps/site && npx wrangler dev --port 8788
```

Push the `dist/` directory to Cloudflare Pages, or wire a Git integration
(GitHub repo → Cloudflare Pages) with build command `bun run --filter
@lorelum/site build` and output directory `dist`.

See `docs/research/tanstack-fumadocs-spike.md` for the spike conclusion and
risks.
