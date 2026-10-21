# F06 company listing and active selection

## Contract and server boundary

GET /companies has no parameters and returns CompanyListResponseDto[] (id, name, document, createdAt, updatedAt). It lists only companies associated with the authenticated user. F02 types and runtime validation preserve the contract; no role, permission or company-detail field is inferred.

F03's existing checkSessionAccess now retains the decoded companies on its server-only authenticated result. CompanyWorkspace uses the authoritative rendering guard's result instead of issuing a second list request. GET /api/auth/session still returns only authenticated: true. All upstream reads remain Bearer-authenticated and no-store, with connection() before render-time expiration checks. The JWT never reaches Client Components.

## Navigation and UI

- F08 places the same company selector in the dashboard header and the existing logout action in the account disclosure. The accessible native select lists company names/documents; it retains React Hook Form/Zod, field errors and pending/disabled states. Selecting a different company immediately submits the existing native POST without a confirmation button; duplicate submissions and unchanged selections are ignored. The server-rendered landing page displays the same verified selection.
- Zero companies redirect to /dashboard/onboarding. F07 renders the protected creation form there, retaining retry/logout. Dashboard users with existing companies can also open that form through Criar nova empresa and return without changing selection. Successful creation verifies and activates the new company. See [onboarding.md](onboarding.md).
- One company is automatically active on every verified render. Multiple companies require a valid stored preference or an explicit choice. An invalid, malformed, removed or foreign-session preference is ignored; no arbitrary first company is chosen.
- /select-company is a protected standalone selection screen, outside the dashboard shell. It reuses getDashboardContext and the same authoritative GET /companies. Zero companies redirect to onboarding; one company or a verified previous selection redirects to dashboard. Otherwise responsive company cards show the documented name/document and native Acessar empresa actions. The page includes logout, loading/error feedback and keyboard-accessible controls. No second company context or client-side listing request is introduced.
- Dashboard, category and product rendering redirect to /select-company when multiple companies have no valid active selection. The dashboard shell is withheld in that state, and company-specific managers are not mounted or fetched. Onboarding remains accessible as the existing independent creation boundary. Login keeps its safe intended dashboard destination; that server boundary resolves onboarding/selection before displaying dashboard content.
- Denied/unavailable list access withholds company data and shows a safe error (with retry for unavailable). Existing 401 handling redirects to login and clears invalid cookies. 403 preserves the session. Suspense supplies a non-sensitive loading state.

## Preference and isolation

The host-only HttpOnly preference cookie is __Host-cartly_company in production (Secure, SameSite=Lax, Path=/) and cartly_company in development. It contains only companyId and a server-computed SHA-256 session binding, never a JWT or credentials. It is a browser-session cookie, sufficient for refresh persistence; no cross-login/browser-restart restoration is promised.

The cookie is untrusted and is not an authorization mechanism. Every restoration compares its binding to the current session and resolves the ID against the freshly verified accessible list. Even overlapping company lists cannot restore another user's session preference. Successful login, local logout and 401 session invalidation clear the preference. Invalid preferences cannot select unavailable IDs, even if a caller forges their contents.

POST /api/companies/active is a local Next.js endpoint, not a new NestJS operation. Both selection cards and the unchanged header switcher submit this same form endpoint. It accepts a same-origin form POST with companyId, validates input, independently authenticates and re-fetches GET /companies, then saves only a current list member. A valid selection redirects to /dashboard; missing/expired/401 sessions clear both cookies and redirect to login. Other failures redirect to /select-company with a safe selection-error marker; 403 never logs out. A marked failure displays retry controls even when an older selection remains valid, preventing a redirect loop or silent loss of feedback. Foreign-origin POSTs return 403 before API or cookie changes. No arbitrary return URL is accepted.

## Context and cache lifecycle

ActiveCompanyProvider/useActiveCompany expose the verified list and selected DTO to company-scoped descendants. The subtree is keyed by the active company ID, so a changed scope discards local state and runs effect cleanup during a server refresh. Native POST selection intentionally starts a full document navigation, also dropping router/client caches and terminating the prior document's in-flight work. No persistent company-data cache, localStorage or server-state dependency is introduced.

Future company data consumers must include company context at the contract-defined location and rely on backend authorization for each request. Context membership is not proof of permission, and resource IDs do not establish ownership. Persistent caches introduced later must include identity/company keys and clear scoped data on session/selection changes. Consumers must clean up their own asynchronous effects.

## Verification and limits

Unit/component tests cover zero/one/multiple lists, restoration, malformed/removed preferences, distinct session bindings, membership revalidation, selection/switching/loading, scope unmount cleanup, local logout/login cleanup, CSRF, 401/403, malformed responses and network failures. The existing production/Chrome suite also verifies real form POSTs, refresh restoration, full document cache reset, onboarding navigation, removed-company handling and a fresh selection after logout/login, using an isolated mock API.

The dedicated selection tests additionally cover server redirects, absence of the dashboard shell/managers before selection, card names/documents, native keyboard submission and duplicate prevention, safe login returns and error-loop prevention. Production HTTP checks verify one company read for selection rendering, no-store/JWT isolation and no product/category reads before selection. Chrome checks first-login selection, valid restoration, removal with multiple alternatives and responsive cards at 320/390/768/1280px, alongside existing switching/stale-work and authentication regressions.

No activated real-backend test account is available. Positive real-NestJS company listing and switching remain a manual integration check; mock-backed results do not claim live authenticated validation. F07 supplies creation/onboarding and F08 supplies the shell/sidebar using this same preference boundary. Role inference and dashboard metrics remain outside these tasks.
