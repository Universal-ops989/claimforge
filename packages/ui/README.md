# @claimforge/ui

ClaimForge's design system: accessible, themeable React components.

## Usage

```tsx
import "@claimforge/ui/styles.css";
import { VisuallyHidden } from "@claimforge/ui";
```

## Principles

- **Accessible by default.** Keyboard support, focus management and ARIA come built in.
  Complex widgets build on [Radix primitives](https://www.radix-ui.com/primitives).
- **Themeable with tokens.** Every color, space and radius is a CSS custom property.
- **No runtime styling cost.** CSS Modules compiled at build time.
- **Composable.** Components forward refs and spread native props.

## Scripts

| Command      | Description                                            |
| ------------ | ------------------------------------------------------ |
| `pnpm build` | Build ESM bundle, CSS and type declarations to `dist/` |
| `pnpm test`  | Run component tests (Vitest + Testing Library)         |
| `pnpm lint`  | ESLint with React, hooks and a11y rules                |
