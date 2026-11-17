import { Heading, Stack, Text } from "@claimforge/ui";

/** The app's root. Routes arrive with the router (item 99, part 2). */
export function App() {
  return (
    <Stack as="main" gap={2} align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <Heading level={1}>ClaimForge</Heading>
      <Text tone="muted">Claims and restoration, from first call to final report.</Text>
    </Stack>
  );
}
