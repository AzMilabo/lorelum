import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/components/landing/landing-page';
import { LandingShell } from '@/components/landing/landing-shell';
import { i18n } from '@/lib/i18n';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <LandingShell lang={i18n.defaultLanguage}>
      <LandingPage lang={i18n.defaultLanguage} />
    </LandingShell>
  );
}
