# Frontend architecture — Cartly Dashboard

## Scope and stack
- Separate Next.js App Router application for the **administrative dashboard** only. Public ordering site and POS belong to other applications.
- Current inspected project: Next.js 16.4.2, React 19.3.0, TypeScript 5, Sass. Vitest and openapi-typescript are development tools from F02; Zod and server-only are runtime dependencies from F03. F04 adds React Hook Form with the Zod resolver, plus React Testing Library, user-event and jsdom for component tests. A dedicated browser E2E framework is not installed.
- `app/` at project root (no `src/`). Prefer Server Components where useful; use Client Components for interactive forms and browser state. Never send sensitive session data unnecessarily to the client.

## Suggested evolving structure (create only as features need it)
```
app/
  (auth)/login/  (auth)/register/  (auth)/activate-account/
  (auth)/forgot-password/  (auth)/reset-password/
  (dashboard)/layout.tsx  (dashboard)/dashboard/
  (dashboard)/companies/  (dashboard)/categories/  (dashboard)/products/
components/ui/            # Input, Button, Select, Modal, Table, Toast
components/layout/        # navigation/header/company switcher
features/<feature>/       # feature components, hooks, forms, schemas, types
lib/api/                  # typed HTTP client, errors, request helpers
lib/auth/                 # session and protected-route helpers
styles/                   # tokens/global SCSS
```
Route group names do not affect URL. Avoid creating folders/routes not requested by a task. Avoid forcing traditional backend Clean Architecture layers into presentation code.

## Separation of responsibilities
- Pages/layouts compose features and route guards; UI primitives are presentation-only.
- Feature components render state; hooks/data adapters orchestrate calls; API client centralizes base URL, credentials/authorization, errors and parsing.
- Schemas validate browser input; backend enforces business rules and authorization.
- F03 session code lives in lib/auth. Local /api/auth endpoints form a same-origin BFF; server-only helpers forward the HttpOnly-cookie JWT through F02. Proxy checks are optimistic; the server rendering/data boundary verifies backend access. See session-management.md. Never rely on a shared layout or JWT decoding alone.
- F04 registration/activation forms and shared validation live in features/auth. Their Server Actions reuse F02 and F03's configured-origin protection. They do not create cookies or authenticate the user. No additional HTTP proxy/client abstraction is introduced.
- Keep DTOs distinct from UI view models where shapes differ. No direct `fetch` sprinkled throughout components.

## Company context
After successful login, call documented `GET /companies`. If empty, guide user to company onboarding; if one/many, choose/restore an authorized active company. Persist only non-sensitive company selection if needed. On switch: clear company-scoped caches/forms, cancel or ignore stale requests and revalidate access. Every documented company-scoped call must include companyId at its specified location, not invented URL prefixes. Never trust only client-side filtering.

## Data state
Use component state for local UI, React Hook Form for forms. A server-state library (e.g., TanStack Query) is an optional later decision after assessing complexity; do not add without a task. Separate server-side and client-side session mechanisms coherently.
