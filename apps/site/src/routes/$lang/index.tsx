import { createFileRoute } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { LandingPage } from '@/components/landing/landing-page';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/$lang/')({
  component: Home,
});

function Home() {
  const { lang } = Route.useParams();
  return (
    <HomeLayout {...baseOptions(lang)}>
      <LandingPage lang={lang} />
    </HomeLayout>
  );
}
