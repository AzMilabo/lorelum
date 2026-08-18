import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { File, Files } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';

/**
 * MDX component map used by every docs page.
 *
 * Fumadocs 16 ships only a minimal set in `fumadocs-ui/mdx`; the richer
 * components (Steps, Tabs, Accordions, Files) live in per-component entry
 * points and must be wired here explicitly.
 */
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Step,
    Steps,
    Tab,
    Tabs,
    Accordion,
    Accordions,
    File,
    Files,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
