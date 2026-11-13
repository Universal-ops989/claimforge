# @claimforge/ui

ClaimForge's design system: accessible, themeable React components.

## Usage

```tsx
import "@claimforge/ui/styles.css";
import { VisuallyHidden } from "@claimforge/ui";
```

## Forms with React Hook Form

Bindings live in a separate entry point, so apps that don't use
`react-hook-form` never load it:

```tsx
import { FormProvider, useForm } from "react-hook-form";
import { FormInput, FormSelect } from "@claimforge/ui/form";

const methods = useForm<NewClaim>({ resolver: zodResolver(schema) });

<FormProvider {...methods}>
  <FormInput<NewClaim> name="policyNumber" label="Policy number" required />
  <FormSelect<NewClaim> name="lossType" label="Loss type" options={LOSS_TYPES} />
</FormProvider>;
```

Errors from the resolver appear under the matching field and are announced
through `aria-describedby`.

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
