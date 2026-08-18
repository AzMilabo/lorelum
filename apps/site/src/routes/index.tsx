import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { TerminalDemo } from '@/components/terminal-demo';
import { appName } from '@/lib/shared';
import { baseOptions } from '@/lib/layout.shared';
import { getStrings } from '@/lib/translations';
import { i18n } from '@/lib/i18n';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const t = getStrings(i18n.defaultLanguage);

  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col flex-1 justify-center px-4 py-8 text-center">
        <h1 className="font-medium text-3xl mb-4">{appName}</h1>
        <p className="mx-auto max-w-xl text-balance text-fd-muted-foreground">{t.tagline}</p>
        <Link
          to="/$lang/docs/$"
          params={{ lang: 'en', _splat: '' }}
          className="mx-auto mt-6 rounded-lg bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          {t.readDocs}
        </Link>
        <TerminalDemo locale={i18n.defaultLanguage} />
      </div>
    </HomeLayout>
  );
}
