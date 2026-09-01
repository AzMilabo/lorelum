import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router';
import * as React from 'react';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { i18nProvider, uiTranslations } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';
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
        title: 'Lorelum — the right Practice for the right task and moment',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
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

const documentTitles: Record<string, string> = {
  en: 'Lorelum — the right Practice for the right task and moment',
  zh: 'Lorelum —— 在正确的任务与关键时刻，检索正确的工程 Practice',
};

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
  React.useEffect(() => {
    document.title = documentTitles[lang] ?? documentTitles[i18n.defaultLanguage];
  }, [lang]);

  return (
    <html suppressHydrationWarning>
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

