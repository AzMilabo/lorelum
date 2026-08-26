import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { LanguageSwitch } from '@/components/language-switch';
import { i18n } from '@/lib/i18n';
import { appName, gitConfig } from './shared';

/** User-facing names for each locale, used in the nav title suffix. */
const localeNames: Record<string, string> = {
  en: 'English',
  zh: '中文',
};

interface BaseOptions {
  /**
   * Show the Fumadocs search trigger in the nav. Marketing landing pages
   * keep the nav clean and hide it; docs pages keep it enabled.
   */
  withSearch?: boolean;
}

/**
 * Shared layout options for both the home and docs layouts.
 *
 * `locale` drives the Fumadocs UI language (via the root provider) and the
 * nav language switcher; it is read from the route params on every page.
 */
export function baseOptions(
  locale: string = i18n.defaultLanguage,
  opts: BaseOptions = {},
): BaseLayoutProps {
  const suffix =
    locale === i18n.defaultLanguage ? '' : ` · ${localeNames[locale] ?? locale}`;
  const { withSearch = true } = opts;

  return {
    // Disable Fumadocs' built-in language select: we render our own
    // `LanguageSwitch` in the nav, so showing both would duplicate the
    // control on every page.
    i18n: false,
    searchToggle: withSearch ? undefined : { enabled: false },
    nav: {
      title: `${appName}${suffix}`,
      // Language switcher sits at the end of the nav, next to the theme toggle.
      children: <LanguageSwitch />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
