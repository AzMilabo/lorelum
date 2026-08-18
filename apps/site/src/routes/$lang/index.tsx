import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { TerminalDemo } from '@/components/terminal-demo';
import { appName } from '@/lib/shared';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/$lang/')({
  component: Home,
});

function Home() {
  const { lang } = Route.useParams();

  return (
    <HomeLayout {...baseOptions(lang)}>
      <div className="flex flex-col flex-1 justify-center px-4 py-8 text-center">
        <h1 className="font-medium text-3xl mb-4">{appName}</h1>
        <p className="mx-auto max-w-xl text-balance text-fd-muted-foreground">
          The right engineering Practice for the right AI coding task and moment.
        </p>
        <Link
          to="/$lang/docs/$"
          params={{ lang, _splat: '' }}
          className="mx-auto mt-6 rounded-lg bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
        <TerminalDemo />
      </div>
    </HomeLayout>
  );
}
