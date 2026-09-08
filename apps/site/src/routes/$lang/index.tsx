import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/components/landing/landing-page';
import { LandingShell } from '@/components/landing/landing-shell';
import { landingHead } from '@/lib/meta';

export const Route = createFileRoute('/$lang/')({
  head: ({ params }) => landingHead(params.lang),
  component: Home,
});

function Home() {
  const { lang } = Route.useParams();
  return (
    <LandingShell lang={lang}>
      <LandingPage lang={lang} />
    </LandingShell>
  );
}
