# @claimforge/tsconfig

Shared TypeScript configurations.

| Config               | Use for                                         |
| -------------------- | ----------------------------------------------- |
| `base.json`          | Node scripts and plain TS packages              |
| `react-library.json` | Publishable React packages (emits declarations) |
| `react-app.json`     | Vite React applications                         |

```json
{ "extends": "@claimforge/tsconfig/react-app.json" }
```
