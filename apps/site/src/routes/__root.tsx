import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router';
import * as React from 'react';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { i18nProvider, uiTranslations } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';
import { getLandingMeta } from '@/lib/meta';
import { zhCN } from '@fumadocs/language/zh-cn';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#0b0b12',
        media: '(prefers-color-scheme: dark)',
      },
      {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
      },
      // The per-language title/description are set by the landing `head` on
      // `/$lang` and `/` (they override this root block). Keeping the title
      // out of the root avoids emitting the English default for `/zh` on SSR.
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        // Inline SVG favicon (no binary asset): a rounded indigo tile with the
        // letter "L". `utf8` data-URI so the hash stays URL-safe.
        rel: 'icon',
        href:
          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%236c6ff5'/><text x='50' y='50' dy='.36em' text-anchor='middle' font-family='system-ui,sans-serif' font-size='62' font-weight='700' fill='white'>L</text></svg>",
      },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
  }),
  component: RootComponent,
});

// Fumadocs UI strings per language; the Chinese pack localizes the search
// trigger, sidebar and other built-in UI labels.
const translations = i18n
  .translations()
  .extend(uiTranslations())
  .preset('zh', zhCN());

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { lang = i18n.defaultLanguage } = useParams({ strict: false });

  // Keep the browser tab title localized (SSR keeps the English default).
  // Same strings as the landing `head` (lib/meta.ts), so they can't drift.
  React.useEffect(() => {
    document.title = getLandingMeta(lang).title;
  }, [lang]);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={i18nProvider(translations, lang)}>{children}</RootProvider>
        <Scripts />
      </body>
    </html>
  );
}

