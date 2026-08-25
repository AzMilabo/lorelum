import { Link } from '@tanstack/react-router';
import { gitConfig } from '@/lib/shared';
import { getStrings } from '@/lib/translations';

export function SiteFooter({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <footer className="relative border-t border-fd-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-fd-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Lorelum</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            to="/$lang/docs/$"
            params={{ lang, _splat: '' }}
            className="transition-colors hover:text-fd-foreground"
          >
            {t.footerDocs}
          </Link>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-fd-foreground"
          >
            {t.footerGithub}
          </a>
          <a
            href={`${githubUrl}/discussions`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-fd-foreground"
          >
            {t.footerDiscussions}
          </a>
          <a
            href={`${githubUrl}/blob/main/LICENSE`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-fd-foreground"
          >
            {t.footerLicense}
          </a>
        </nav>
      </div>
    </footer>
  );
}
