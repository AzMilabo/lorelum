import { Link, useLocation, useParams } from '@tanstack/react-router';
import { Languages } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import { getStrings } from '@/lib/translations';

/**
 * Minimal language switcher rendered in the docs/home nav.
 *
 * Swaps the `/lang` segment of the current path to the other supported
 * locale, so the user stays on the same page in the other language. The
 * static links also let the build-time crawler discover translated pages.
 */
export function LanguageSwitch() {
  const { lang = i18n.defaultLanguage } = useParams({ strict: false });
  const { pathname } = useLocation();
  const t = getStrings(lang);
  const other = i18n.languages.find((l) => l !== lang) ?? i18n.defaultLanguage;

  // `/lang/...` -> `/other/...`; unprefixed root path -> `/${other}`
  const target = pathname.startsWith(`/${lang}`)
    ? pathname.replace(`/${lang}`, `/${other}`)
    : `/${other}${pathname === '/' ? '' : pathname}`;

  return (
    <Link
      to={target}
      className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      aria-label={`${t.switchTo} ${other === 'zh' ? '中文' : 'English'}`}
    >
      <Languages className="size-4" />
      <span>{other === 'zh' ? '中文' : 'English'}</span>
    </Link>
  );
}
