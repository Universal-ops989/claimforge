# ClaimForge Roadmap

ClaimForge is a property-damage claims and restoration platform. Adjusters, restoration
contractors and policyholders use it to document losses, track mitigation work, and
produce estimates and reports.

Each line below is one pull request. PRs are small, reviewable and independently
mergeable; every PR leaves `main` green.

Legend: `api` = FastAPI backend · `ui` = design system · `web` = main app ·
`portal` = policyholder portal · `infra` = tooling/CI

---

## M0 — Foundation (infra)

1. Repository bootstrap: README, license, gitignore, editorconfig, roadmap
2. pnpm workspace + Turborepo pipeline
3. Shared TypeScript config package (`@claimforge/tsconfig`)
4. Shared ESLint + Prettier config package (`@claimforge/eslint-config`)
5. Python API scaffold with uv (FastAPI app factory, `/healthz`)
6. Ruff + mypy (strict) configuration for the API
7. Pytest setup with async client fixture
8. docker-compose for Postgres + Mailpit for local dev
9. GitHub Actions: API lint + test workflow
10. GitHub Actions: web lint + typecheck + test workflow
11. PR template, issue templates, CODEOWNERS, CONTRIBUTING guide
12. Root task runner (`justfile`) with install / lint / test / dev recipes

## M1 — Design system (`packages/ui`)

13. UI package scaffold with Vite library build
14. Storybook 8 setup with theme switcher and a11y addon
15. Design tokens: color, spacing, radius, typography, shadows, z-index
16. Theme provider with light/dark modes and CSS variables
17. `Button` with variants, sizes, loading and icon slots
18. `IconButton` and icon set wrapper (lucide)
19. `Text` and `Heading` typography primitives
20. `Stack`, `Inline`, `Grid` layout primitives
21. `Input` with prefix/suffix and error state
22. `Textarea` with autosize
23. `Select` (accessible listbox)
24. `Checkbox` and `CheckboxGroup`
25. `Radio` and `RadioGroup`
26. `Switch`
27. `FormField` (label, hint, error) + React Hook Form adapters
28. `Badge` and `StatusPill`
29. `Avatar` and `AvatarGroup`
30. `Card` with header/body/footer slots
31. `Dialog` (modal) with focus trap
32. `Drawer` (side sheet)
33. `Toast` system with queue and imperative API
34. `Tooltip` and `Popover`
35. `Tabs`
36. `Menu` / dropdown actions
37. `DataTable` with sorting, selection and column config
38. `Pagination`
39. `EmptyState`, `Skeleton`, `Spinner`
40. `DatePicker` and `DateRangePicker`
41. `FileDropzone` with progress
42. `Breadcrumbs`
43. `AppShell` with collapsible `Sidebar` and `Topbar`
44. `Stepper` for multi-step flows
45. Interaction tests for components (Storybook test runner)
46. Publish Storybook to GitHub Pages in CI

## M2 — Backend core (`apps/api`)

47. Settings via pydantic-settings, environment profiles
48. SQLAlchemy 2 async engine + session dependency
49. Alembic migrations setup
50. Base model mixins (UUID PK, timestamps, soft delete)
51. Structured JSON logging + request ID middleware
52. Problem-details error handling
53. Cursor pagination utilities
54. Organizations model + CRUD
55. Users model + CRUD
56. Password hashing (argon2) and login endpoint
57. JWT access + refresh tokens, token rotation
58. Current-user dependency and auth guards
59. Roles and permissions (RBAC) with policy checks
60. Organization invitations
61. Audit log model + automatic recording
62. OpenAPI schema export script
63. Rate limiting middleware

## M3 — Claims domain (`api`)

64. Policyholder / contacts model + endpoints
65. Property (loss location) model with address normalization
66. Claim model + create/read endpoints
67. Claim list with filtering, sorting, search
68. Claim status workflow (state machine + transition rules)
69. Claim assignments (adjuster, contractor, field tech)
70. Structures and rooms model
71. Damage items per room (category, class, cause of loss)
72. Notes with mentions
73. Tasks with due dates and assignees
74. Claim timeline (aggregated activity feed)
75. Full-text search across claims and contacts

## M4 — Field documentation (`api`)

76. Storage abstraction (local disk + S3-compatible)
77. Photo upload with presigned URLs
78. Thumbnail generation worker
79. Photo captions, tags and room linking
80. Document attachments
81. Moisture readings and drying logs
82. Equipment inventory and placement tracking
83. Atmospheric readings (temperature, RH, GPP calculation)
84. Drying goal tracking and dry-standard alerts

## M5 — Estimates & reports (`api`)

85. Price list model + import from CSV
86. Estimate and line items
87. Estimate totals, tax and overhead/profit calculation
88. Report template model
89. PDF report generation (photo report)
90. PDF drying report
91. Report generation jobs + status polling
92. Shareable report links with expiry

## M6 — Typed client (`packages/api-client`)

93. Generate TypeScript types from OpenAPI
94. Fetch wrapper with auth refresh and Zod validation
95. TanStack Query hooks for auth, users, orgs
96. TanStack Query hooks for claims, rooms, tasks, notes
97. TanStack Query hooks for media, readings, estimates, reports
98. MSW handlers + fixtures for frontend tests

## M7 — Main web app (`apps/web`)

99. Web app scaffold (Vite, React Router, Query client)
100. Auth: login, logout, session refresh, protected routes
101. App shell with navigation and org switcher
102. Dashboard: KPIs and recent activity
103. Claims list page with filters and saved views
104. Create-claim wizard
105. Claim detail layout with tabs
106. Claim overview tab (status, assignments, contacts)
107. Rooms and damage tab
108. Photo gallery with upload and lightbox
109. Moisture/drying tab with charts
110. Equipment tab
111. Notes and mentions tab
112. Tasks board (kanban)
113. Estimate editor
114. Reports tab with generation and download
115. Timeline tab
116. Global search (command palette)
117. Settings: profile, password
118. Settings: organization, members, invitations
119. Settings: price lists
120. Keyboard shortcuts and accessibility pass

## M8 — Policyholder portal (`apps/portal`)

121. Portal scaffold and magic-link login
122. Claim status tracker
123. Photo and document upload for policyholders
124. Messages between policyholder and adjuster

## M9 — Notifications & realtime

125. Notification model and preferences
126. Email notifications (templated, via SMTP)
127. In-app notification center
128. Server-sent events for live claim updates
129. Outbound webhooks with signing and retries

## M10 — Quality & operations

130. Seed data command with realistic demo claims
131. Playwright end-to-end test suite
132. Dockerfiles for API and web
133. Production docker-compose
134. i18n framework and English/Spanish locales
135. Performance: query indexes and N+1 checks
136. Security hardening (CSP headers, CORS, dependency audit)
137. Architecture decision records (docs/adr)
138. Deployment guide and demo walkthrough
