import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { LanguageSwitch } from '@/components/language-switch';
import { i18n } from '@/lib/i18n';
import { appName, gitConfig } from './shared';

/**
 * Shared layout options for both the home and docs layouts.
 *
 * `locale` drives the Fumadocs UI language (via the root provider) and the
 * nav language switcher; it is read from the route params on every page.
 */
export function baseOptions(locale: string = i18n.defaultLanguage): BaseLayoutProps {
  return {
    nav: {
      title: `${appName}${locale === i18n.defaultLanguage ? '' : ` · ${locale}`}`,
      // Language switcher sits at the end of the nav, next to the theme toggle.
      children: <LanguageSwitch />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
