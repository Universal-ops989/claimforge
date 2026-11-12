# @claimforge/eslint-config

Shared ESLint 10 flat configs.

```js
// eslint.config.js
import react from "@claimforge/eslint-config/react";
export default react;
```

| Entry   | Includes                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------- |
| `base`  | `@eslint/js`, typescript-eslint strict + stylistic (type-checked), import ordering, Prettier compat |
| `react` | `base` + `@eslint-react`, `react-hooks` (incl. compiler rules), `jsx-a11y`                          |
