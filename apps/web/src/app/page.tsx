import { Heading, Inline, Stack } from "@claimforge/ui";
import type { ReactNode } from "react";

import { PageTitle } from "./page-title";

export interface PageProps {
  /** The page's heading, and its part of the document title. */
  title: string;
  /** Buttons at the end of the header, e.g. "New claim". */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A page's frame: its title in the tab and as the one `<h1>`, its actions, then content. */
export function Page({ title, actions, children }: PageProps) {
  return (
    <Stack as="section" gap={6} aria-labelledby="page-title">
      <PageTitle title={title} />
      <Inline justify="between" align="center" gap={4}>
        <Heading level={1} id="page-title">
          {title}
        </Heading>
        {actions}
      </Inline>
      {children}
    </Stack>
  );
}
