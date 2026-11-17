import { useParams } from "react-router";

import { Page } from "../app/page";

/** One claim, by its number: `/claims/2026-00042`. */
export function ClaimPage() {
  const { number = "" } = useParams();
  return <Page title={`Claim ${number}`} />;
}
