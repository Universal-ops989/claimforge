/** Sets the document title to "`title` · ClaimForge". React hoists `<title>` into `<head>`. */
export function PageTitle({ title }: { title: string }) {
  return <title>{`${title} · ClaimForge`}</title>;
}
