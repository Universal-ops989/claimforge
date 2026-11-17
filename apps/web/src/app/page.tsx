import { Heading, Stack } from "@claimforge/ui";
import type { ReactNode } from "react";

import { PageTitle } from "./page-title";

export interface PageProps {
  /** The page's heading, and its part of the document title. */
  title: string;
  children?: ReactNode;
}

/** A page's frame: its title in the tab and as the one `<h1>`, then its content. */
export function Page({ title, children }: PageProps) {
  return (
    <Stack as="section" gap={6} aria-labelledby="page-title">
      <PageTitle title={title} />
      <Heading level={1} id="page-title">
        {title}
      </Heading>
      {children}
    </Stack>
  );
}
