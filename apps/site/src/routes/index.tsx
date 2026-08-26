import { createFileRoute } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { LandingPage } from '@/components/landing/landing-page';
import { i18n } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions(i18n.defaultLanguage, { withSearch: false })}>
      <LandingPage lang={i18n.defaultLanguage} />
    </HomeLayout>
  );
}
