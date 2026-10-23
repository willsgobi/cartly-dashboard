# Frontend architecture — Venduzily Dashboard

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
- F13 recovery/reset forms extend those same public Server Actions and schemas. app/(auth)/(recovery)/layout.tsx scopes an in-memory email context to the two recovery routes; leaving them discards it. No browser storage, credential URL parameters, new session logic or HTTP client is added. See modules/authentication.md.
- F05 LoginForm reuses the same components/schemas. Its small browser adapter calls only the existing same-origin /api/auth/login BFF with cookie credentials; it does not replace F02 or call NestJS directly. The Server Component sanitizes returnTo, the BFF validates it again, and a full document navigation starts protected rendering with the new cookie. Existing native POST logout remains unchanged.
- Keep DTOs distinct from UI view models where shapes differ. No direct `fetch` sprinkled throughout components.

F08 provides the authenticated route-group layout in app/(dashboard)/layout.tsx, composed from components/layout. Server-rendered pages and layout share features/companies/server-context.ts through React request-only memoization, so the authoritative guard/list check runs once per request. ActiveCompanyProvider wraps header and page content. Dynamic reads remain beneath Suspense and connection(); neither use cache nor persistent layout state is an authorization boundary. See [modules/dashboard.md](modules/dashboard.md) for mobile dialog, unavailable navigation and display-user behavior.

## Company context
After successful login, call documented `GET /companies`. If empty, guide user to company onboarding; if one/many, choose/restore an authorized active company. Persist only non-sensitive company selection if needed. On switch: clear company-scoped caches/forms, cancel or ignore stale requests and revalidate access. Every documented company-scoped call must include companyId at its specified location, not invented URL prefixes. Never trust only client-side filtering.

F06 implements this boundary in features/companies, reusing the authenticated guard's existing GET /companies result. ActiveCompanyProvider/useActiveCompany expose verified company DTOs. A session-bound HttpOnly preference is rechecked against the current list; login/logout/401 clear it. Native POST switching performs a full document navigation, and the provider keys its subtree by company ID to discard company-local state on scope changes. See [modules/companies.md](modules/companies.md).

The protected /select-company page reuses that request-scoped context and the existing selection POST for responsive company cards. No second provider, list service or persistence strategy is added. Dashboard/module server boundaries redirect unselected multi-company sessions there and withhold company-specific UI/data; zero-company onboarding remains unchanged. A sole company or authorized saved session preference resolves directly to dashboard. Proxy and safe return URLs include the new exact selection route. Preferences retain F06's session lifetime and login/logout isolation.

F17 lives in features/companies/settings and /dashboard/settings/company, linked from the existing Configurações navigation. Fixed company/detail/address BFF routes reuse F02/F03/F06 verification and generated DTOs. Existing addresses are edited by ID; number remains read-only under the supplied contract. Successful company edits refetch details and refresh the server layout/F06 list while retaining active ID and unrelated form state. ViaCEP calls reuse F07's transport/handler; scope teardown cancels all pending work. See [modules/company-settings.md](modules/company-settings.md).

F07 fills /dashboard/onboarding with a two-step form in features/companies/onboarding. Authenticated same-origin Route Handlers forward only fixed ReceitaWS/ViaCEP lookups and the documented Venduzily creation DTO. The lookup hook isolates cancellation/edit-version logic from presentation; failed lookups permit manual input. Creation refreshes the verified F06 list and sets the existing preference only if the created ID is accessible, then uses a full navigation. A committed creation with failed synchronization offers only the existing F06 selection POST, preventing duplicate creation. See [modules/onboarding.md](modules/onboarding.md) for public-provider quotas and deployment limits.

## Data state

F09 lives in features/categories. The protected /dashboard/categories page verifies the shared server company context; CategoriesManager consumes F06 and requests only fixed same-origin BFF operations. Server-only category services use the existing authenticated typed client and OpenAPI DTOs. Each BFF request independently resolves the session-bound active selection against the current accessible list and rejects stale client scopes. Runtime response validation rejects foreign-company data. No category-detail endpoint or permission source is invented. See [modules/categories.md](modules/categories.md) for modal lifecycle, error mapping and permission-source limitations.

Use component state for local UI, React Hook Form for forms. A server-state library (e.g., TanStack Query) is an optional later decision after assessing complexity; do not add without a task. Separate server-side and client-side session mechanisms coherently.

F10 adds features/products and /dashboard/products using the same layout/provider. Fixed product BFF operations reuse F02/F03 and F09's extracted lib/companies/active-request.ts verification; both feature browser adapters share lib/api/browser-request.ts. Product services reuse F09 category listing for mutation membership checks. Numeric price compatibility is explicit and limited to two product request types; generated contracts stay unchanged. Product application models validate unknown responses and preserve existing variants during edits. See [modules/products.md](modules/products.md).

F11 extends that same product form with discriminated initial-variant schemas, RHF field arrays and shared VariantFields. VariantManagement is composed inside ProductDetails and uses only fixed POST/DELETE BFF routes, sharing existing transport/auth/scope checks. Numeric compatibility now also covers nested initial variant prices and the standalone variant POST, without changing generated contracts. Mutations refresh details/list independently of their commit and respect company teardown. Last-variant backend gaps are documented rather than hidden; no variant update route is added.

F12 extends the same VariantManagement form with an edit mode in a nested native Modal and enables PATCH on the existing fixed variant BFF route. The corrected contract was supplied by the user and generated types were regenerated. Partial DTOs preserve type-specific pricing; all mutation and refresh lifecycle behavior stays in the existing F11 boundary. No additional API client, company-selection logic or variant interface is introduced. See modules/products.md for nested cancellation/focus and runtime monetary compatibility.
