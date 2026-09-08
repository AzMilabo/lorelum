import { createFileRoute, notFound } from '@tanstack/react-router';
import { getLLMText, source } from '@/lib/source';
import { decodeMarkdownUrl } from '@/lib/shared';

export const Route = createFileRoute('/$lang/docs/{$}.md')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split('/') ?? []);
        const page = source.getPage(slugs, params.lang);
        if (!page) throw notFound();

        return new Response(await getLLMText(page), {
          headers: {
            'Content-Type': 'text/markdown',
          },
        });
      },
    },
  },
});
