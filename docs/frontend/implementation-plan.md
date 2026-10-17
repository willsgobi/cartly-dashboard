# Cartly Dashboard — implementation plan

## Protocol
One task at a time, in the order of dependencies. `TODO` → `IN PROGRESS` → `DONE` only with acceptance evidence. Do not implement unsupported modules or undocumented endpoints.

| ID | Task | Depends on | Acceptance | State |
|---|---|---|---|---|
| F01 | Inspect/migrate starter styling and set Inter, global SCSS tokens and UI primitives | — | App builds; no accidental Tailwind/Geist remnants; responsive Input/Button with keyboard states | DONE |
| F02 | Typed API client, environment config and error mapping | F01 | Real OpenAPI paths/DTOs, authorization forwarding design documented and testable | DONE |
| F03 | Authentication, HttpOnly JWT session management and protected route foundation | F02 | Documented BFF; bounded cookie lifetime; server guards; 401 invalidation; 403 preservation; CSRF and tests | DONE |
| F04 | Registration and activation screens | F01,F02 | POST register/activate/resend; 8-digit OTP, loading/errors | DONE |
| F05 | Login/logout-local and route protection | F02,F03 | documented login; session handling and protected layout; tests | DONE |
| F06 | Companies list and active-company selection | F05 | GET /companies; zero/one/multiple-company behavior; isolation | DONE |
| F07 | Company onboarding + address with CNPJ/CEP autofill | F06 | POST /companies; exact DTO; protected optional lookups; manual fallback and verified active selection | DONE |
| F08 | Dashboard shell/sidebar/mobile nav | F06 | accessible responsive layout with active-company context | DONE |
| F09 | Categories list/create/edit/delete | F08 | documented category routes; 204 handling; 403/409 feedback | TODO |
| F10 | Products list/detail/create/update/soft-delete | F08,F09 | company scoping and product pricing rules; GET query, update/delete body | BLOCKED: price schema clarification for forms |
| F11 | Product variants creation/deletion | F10 | documented POST/DELETE; ensure invariant-safe UX | TODO |
| F12 | Variant update | F11 | PATCH URL verified with backend, update flow tested | BLOCKED: malformed Swagger URL |
| F13 | Password recovery and reset | F02,F04 | forgot/reset endpoints; 8-digit OTP; no account enumeration | TODO |
| F14 | Dashboard metrics and remaining modules | F08 | only after corresponding endpoints are documented | BLOCKED: missing APIs |
| F15 | Accessibility, responsive + regression E2E pass | relevant preceding tasks | no critical failures; results reported | TODO |

Start with **F01**. The agent must only perform subsequent tasks after explicit request. Tasks may be further split before execution (e.g. F10 list vs create) to keep scope small.

## F01 acceptance evidence — 2026-10-16

- Replaced starter CSS with global SCSS and centralized Cartly tokens; configured Inter 400/500/600/700 through next/font/google.
- Added native typed Input/Button primitives with SCSS Modules, ref support, label/error associations, keyboard focus, disabled states and button loading/variants.
- Added the component demonstration at /; the existing /app route reuses it with a nested layout that inherits the root document and styles.
- Removed Tailwind/Geist starter imports from the nested route. No application, styling or package references remain.
- Passed: npx tsc --noEmit --incremental false; npm run lint; npm run build.
- Passed a temporary automated Chrome headless check against the production server on both routes: labels/errors, required/disabled/loading semantics, Inter loading, Tab order and visible focus, text entry, reduced motion, no horizontal overflow and responsive columns at 320/375/768/1280 px. No browser errors were reported. The check used native Chrome DevTools Protocol without installing dependencies.
- No outstanding F01 blockers. F02 remains unstarted.

## F02 acceptance evidence — 2026-10-16

- Added a centralized native Fetch client in lib/api with OpenAPI-derived method/path/body/parameter constraints, optional per-request Bearer tokens, AbortSignal, encoded path/query parameters and JSON/empty-response handling.
- Generated types with openapi-typescript; api:generate and api:check provide reproducible generation and drift checks. Required, optional and nullable fields are preserved. Ambiguous object-valued prices, the duplicated variant PATCH path and underspecified DELETE response schemas remain unchanged.
- Added lazy validated server-side API_BASE_URL configuration and a non-sensitive .env.example. No production/development backend URL is hardcoded in services; no services, token persistence or session management were introduced.
- Added independent ApiError classification with safe pt-BR messages for HTTP/network/cancellation/invalid responses/configuration/request preparation. Original HTTP statuses and untrusted HTTP diagnostic bodies are preserved separately.
- Documented the authorization forwarding boundary, no implicit cookie forwarding/caching, response decoding, configuration and typed examples in api-integration.md. F03 session decisions remain pending.
- Passed: npm test (74 tests across 4 files), npx tsc --noEmit --incremental false, npm run api:check, npm run build and git diff --check.
- npm run lint exited successfully with zero errors and one existing unused Logo import warning in app/page.tsx; F01 components/page were not changed.
- npm audit --json reported 5 high-severity findings in the existing development-only eslint-config-next / fast-glob / micromatch / braces dependency chain. The same packages/versions were already present in the prior lockfile. Dependency remediation is outside F02 and was not applied automatically.
- No outstanding F02 blockers. Product pricing/variant-path contract questions remain open for their dependent tasks. F03 was not started.

## F03 acceptance evidence — 2026-10-16

- Scope was explicitly expanded by the user to implement the session BFF, local logout and protected route foundation. Full login UI/company selection remain future work; F05's dependency is now satisfied but it has not been started.
- Added server-only JWT cookie handling, Zod request/response validation, fixed-destination F02 forwarding, explicit Origin-based CSRF checks, safe internal returns and normalized session errors. Cookie expiry is bounded by JWT exp; tokens without a usable exp fail closed. No token persistence in browser storage, refresh, retry loop or invented backend endpoint.
- Added local login/logout/session Route Handlers, Next.js 16 Proxy, authoritative server rendering guard and minimal protected/login status shells. GET /companies is used only as an existing authenticated probe; no company feature or permissions are inferred. Cookie-only optimistic checks cannot grant protected rendering.
- 401 invalidates the session and returns/redirects to a safe login destination; 403 preserves the cookie and displays an access-denied state. Protected responses and upstream requests are no-store. Logout removes only the local cookie and does not revoke the backend token.
- Passed: npm test (167 tests in 9 files), npx tsc --noEmit --incremental false, npm run api:check, npm run build and npm run test:auth:production. Production checks run a real Next.js server against a synthetic loopback-only API and verify protected HTML, forged/expired JWTs, 401/403 behavior, cookie flags, CSRF, GET 405, no-store, no token leakage and logout.
- ESLint exited successfully with zero errors and the pre-existing unused Logo import warning in app/page.tsx. Existing npm audit findings from the ESLint dependency chain remain unchanged. No backend/OpenAPI or F01 component changes were made.
- Architecture and remaining boundaries are documented in session-management.md. Production hosting must configure API_BASE_URL, APP_ORIGIN and HTTPS. No real deployment/backend credentials were required or used. F04 was not started.

## F04 acceptance evidence — 2026-10-16

- Added /register and /activate-account with React Hook Form/Zod, F01 Input/Button reuse, reusable password visibility, native POST semantics, accessible labels/errors/status, focus on invalid fields and disabled/loading states with duplicate submission guards. No unsupported password length/complexity rule was added.
- Added fixed-operation Server Actions for POST /auth/register, POST /auth/activate-account and POST /auth/resend-activation, using F02 and F03 origin protection. Validated responses reuse the existing safe user DTO. confirmPassword is not sent; no cookies, JWTs, automatic login, retries or rate-limit/cooldown rules are introduced.
- OTP remains an eight-digit string with paste support and leading zeros. Registration navigates to activation without putting email/password/OTP in the URL; email is entered on the activation screen. Successful activation clears inputs and navigates to the login shell with a friendly success message. Login/register/activation navigation and generic resend confirmation are implemented.
- Passed: npm test (220 tests across 13 files), npx tsc --noEmit --incremental false, npm run lint (zero errors; existing unused Logo warning), npm run build, npm run api:check and git diff --check.
- Passed a temporary automated Chrome headless check against a real local production Next.js server and isolated mock API: required/matching-password validation, exact registration DTO, leading-zero OTP, resend/loading, success navigation, direct activation, invalid/expired OTP, duplicate email, safe errors, no automatic session and no credentials/OTP/email in URLs. Layout had no horizontal overflow at 320/390/768/1280 px and no browser JavaScript exceptions. Mobile screenshot was visually inspected.
- The actual local NestJS API was available: GET /companies without authentication returned 401; negative-path POST checks for register/activate/resend returned documented 400 responses. No account was created and no real email was sent. Positive real-mailbox registration/activation remains a manual integration check requiring an authorized test email/OTP; complete success was verified with mocks, not claimed against NestJS.
- No backend/OpenAPI changes, password recovery, company onboarding or F05 login form work. Existing session and API tests remain green. F05 was not started.

## F05 acceptance evidence — 2026-10-16

- Audited and reused F02/F03: documented NestJS login, same-origin BFF, bounded HttpOnly cookie, authoritative protected rendering, Bearer forwarding, public auth routes, local POST logout, no-store, CSRF, safe internal return URLs, invalid/expired JWT handling, 401 invalidation, 403 preservation and redirect-loop prevention. No client, BFF endpoint or session implementation was duplicated.
- Added the missing functional /login form using React Hook Form/Zod and existing Input/PasswordInput/Button/styles. Required/email validation, keyboard interaction, visibility, pending/disabled states, duplicate-submission prevention, safe pt-BR errors and registration/activation navigation are included. Credentials are never put in URLs or browser storage.
- The server sanitizes returnTo, the browser calls only the existing /api/auth/login, and a validated success starts a full document navigation to the intended dashboard URL. The existing Sair form clears the session locally; no backend JWT revocation is claimed. No F06 routing or company features were added.
- Passed: npm test (240 tests across 15 files), npx tsc --noEmit --incremental false, npm run lint (zero errors; existing unused Logo warning), npm run build and git diff --check.
- Passed: npm run test:auth:browser, including the existing production HTTP suite and actual Chrome checks against the production Next.js server with an isolated mock API. Verified successful/invalid UI login, safe returns, cookie attributes and invisibility to document.cookie, protected API access, refresh persistence, 401 cleanup, 403 preservation, native logout, blocked protected history after logout, responsive widths 320/390/768/1280 and no browser exceptions. Existing tests cover local expiry, forged JWTs, CSRF and no redirect loops.
- Actual local NestJS returned 401 for invalid credentials, missing authorization, forged future JWTs and expired synthetic JWTs. The existing local Next.js BFF returned 401 for invalid credentials and 303 for unauthenticated dashboard access. No authorized activated test account was available: positive real-backend login/protected access/persistence/logout remain a manual integration limitation, explicitly distinguished from the successful mock-backed checks. No real credentials were logged, stored or committed.
- No implementation blockers remain. Production requires configured API_BASE_URL, APP_ORIGIN and HTTPS as documented. F06 remains unstarted.

## F06 acceptance evidence — 2026-10-16

- Reused F02/F03's authenticated GET /companies, deriving Company from the unchanged OpenAPI DTO and extracting its runtime decoder. The rendering guard now retains that verified list instead of discarding it, so company rendering does not issue a duplicate probe. JWTs remain server-only and requests remain no-store.
- Added reusable ActiveCompanyProvider/useActiveCompany and an accessible native company selector using existing Button, Cartly SCSS/tokens, React Hook Form and Zod. Zero companies redirect to a protected /dashboard/onboarding empty boundary; one is automatic; multiple require a verified preference or explicit selection. The boundary contains retry/logout only, with no F07 creation form or backend mutation.
- Added a session-bound HttpOnly host-only company preference, Secure in production. Restoration resolves only against the current authenticated accessible list. Malformed/removed/foreign-session IDs are ignored, including overlapping company lists. Login/logout/401 clear the preference; 403 preserves the session. The cookie is a selection hint and never proof of authorization.
- Added a same-origin native POST selection boundary that re-fetches membership through the authenticated client before saving. Full document switching clears router/document caches and prior in-flight work. The context also keys its subtree by company ID, resetting company-local state/effects during scope changes. No persistent company-data cache or new dependency was introduced.
- Added safe loading, empty, denied/unavailable and selection-error states. Existing 401 redirects, expiration handling, CSRF and no-store behavior remain in place. The initial HTML explicitly renders an empty selection before hydration when multiple companies have no valid preference.
- Passed: npm test (276 tests across 19 files), npx tsc --noEmit --incremental false, npm run lint (zero errors; pre-existing unused Logo warning), npm run api:check, npm run build and git diff --check.
- Passed npm run test:auth:browser against the final production build with an isolated loopback mock API. Verified zero/one/multiple companies, actual native POST selection and switching, refresh restoration, removed company handling, full document cache reset, protected onboarding navigation, cookie deletion on logout, fresh selection after a new login, responsive widths and existing authentication regressions.
- Positive authenticated real-NestJS company listing/switching remains a manual integration check because no activated test-account credentials were provided. No real account/company was created, no backend/OpenAPI contract changed, and no role or permission was invented. No implementation blockers remain; F07 was not started.

## F07 acceptance evidence — 2026-10-17

- Added a responsive two-step company/address form using React Hook Form/Zod and existing Cartly Input/Button/tokens. Values persist across steps, focus follows navigation, autofilled fields remain editable, and lookup/creation feedback is independent. CNPJ format/check digits and eight-digit CEP are validated and normalized; only exact CreateCompanyDto fields are submitted. Manual creation does not depend on lookup success.
- Added protected same-origin lookup Route Handlers calling only fixed ReceitaWS/ViaCEP URLs. Requests have eight-second timeouts, cancellation, no-store, no credential forwarding and safe pt-BR errors. ReceitaWS status/data and ViaCEP erro/payload/CEP matching are verified rather than assuming HTTP 200 establishes success. No raw provider payloads are retained or exposed.
- CNPJ queries are explicit; valid CEP queries run on blur/confirmation, with duplicate suppression and no automatic ViaCEP request after a complete CNPJ address. Request generations, cancellation and per-field edit versions prevent stale asynchronous writes and preserve manually changed fields/address number. Final submission cancels pending queries and prevents duplicate creation.
- Applied a process-wide rolling-window ReceitaWS throttle of three requests/minute and an independent application CEP throttle. Multi-instance/serverless/shared-egress deployment requires shared quota enforcement; this operational limitation is documented in modules/onboarding.md. No distributed storage dependency was added.
- Added an authenticated JSON creation BFF using F02/F03 and a shared 16 KiB bounded request reader extracted from login. It forwards POST /companies once, validates CompanyResponseDto, handles 400/401/403/409/500 safely and preserves form inputs on errors. It refreshes the F06 list, verifies membership before setting the existing active-company cookie, and navigates the full document to the dashboard to discard stale state.
- A committed creation with failed membership synchronization disables creation and offers only F06's existing access/selection action; it never automatically repeats POST /companies. Logout/401 behavior and company authorization remain unchanged. No backend/OpenAPI changes, new Cartly fields, roles or F08 features were introduced.
- Passed: npm test (338 tests across 25 files), npx tsc --noEmit --incremental false, npm run lint (zero errors; existing unused Logo warning), npm run api:check, npm run build and git diff --check.
- Passed npm run test:auth:browser against the production Next.js server and isolated mock NestJS. Browser lookup responses are intercepted so public providers are never called during automation; successful/error provider mappings are independently tested with mocked Fetch. Verified two steps, manual fallback, retained values, exact normalized creation, single POST, active-company synchronization, dashboard redirect/refresh, responsive widths 320/390/768/1280 and existing F03/F06 regressions. Mobile screenshot was visually inspected. Browser automation explicitly waits for hydration/dynamic content before interactions/assertions.
- Live positive NestJS creation and live public lookups were not claimed: no activated test account was supplied, and automated tests require no public API availability. Numeric-only CNPJ matches the user's explicit 14-digit requirement; alphanumeric support is outside this task. No implementation blockers remain for the configured single-process application. F08 remains unstarted.

### F07 follow-up — additional company entry point — 2026-10-17

- Added Criar nova empresa on the authenticated dashboard and reused /dashboard/onboarding for users who already have companies. Removed the nonempty-list redirect from that form; zero-company onboarding and all server authorization remain intact. Voltar ao dashboard leaves the existing company selected, while successful creation verifies and activates the additional company through the existing flow.
- Updated workspace tests and the production Chrome scenario to cover the link, access with existing companies, cancellation preserving selection, and creation/activation alongside an existing company. Passed npm test (338 tests/25 files), TypeScript, ESLint (existing unused Logo warning only), production build, npm run test:auth:browser and git diff --check. Real-backend validation limitations remain unchanged. F08 was not started.

## F08 acceptance evidence — 2026-10-17

- Added a reusable App Router route-group layout with modular Sidebar/SidebarNavigation, DashboardHeader, MobileNavigation, UserMenu, decorative SVG icons and SCSS Modules. Reused Cartly logo, Inter/tokens, existing Button and F06 CompanySelector/ActiveCompanyProvider. Server-rendered pages/layout share one request-scoped authoritative company/context read; no persistent authorization cache or duplicate list request is introduced.
- Added all requested pt-BR navigation labels. Dashboard is the only real module link and uses exact aria-current; unavailable modules are noninteractive Em breve entries. The minimal landing greets the authenticated user and shows the active company or selection prompt. No fake metrics, business pages, permission rules, backend operations or dependencies were added.
- Header selection reuses F06 native authenticated POSTs and preference restoration. Zero-company onboarding, additional-company creation, denied/network states, 401 cleanup and 403 preservation remain functional. Company creation/back/retry links refresh the full document so App Router layout reuse cannot retain an outdated header context after list changes.
- Persisted only validated login name/email in a bounded HttpOnly display cookie, Secure in production and integrity-bound to the current server-side JWT. Authentication remains F03/backend-authoritative; no JWT/signature is exposed to Client Components and no /me endpoint/secret/permission claim is invented. Logout/401 delete the snapshot. Existing sessions without a snapshot retain generic welcome/account text until login.
- Desktop sidebar becomes a native modal drawer below 64rem. Reused navigation closes on selection, Escape, close button and backdrop; background is inert, body scroll is locked and trigger focus is restored. Added semantic landmarks, skip link, decorative icons, keyboard controls and visible focus. User menu uses native disclosure and the existing local logout POST.
- Passed npm test (353 tests across 28 files), npx tsc --noEmit --incremental false, npm run lint (zero errors; existing unused Logo warning), npm run build and git diff --check.
- Passed npm run test:auth:browser against final production Next.js and isolated mock API: safe user welcome/refresh, profile/JWT HttpOnly and logout cleanup, company selection/switching/onboarding, desktop navigation, native modal background inertness, keyboard/Escape, overlay/navigation closure and focus restoration. Verified no horizontal overflow at 320/390/768/1280px and no browser exceptions. Desktop/mobile/drawer screenshots were visually inspected. The HTTP suite verifies exactly one company list request for shared layout/page rendering.
- Positive real-NestJS validation still requires an activated test account; all automated integration results use controlled mocks. Login-time profile snapshots do not track later backend profile edits because no current-user endpoint exists. No implementation blockers remain. F09 was not started.

### F08 follow-up — compact sidebar and immediate company selection — 2026-10-17

- Reduced desktop sidebar width from 256px to 224px and adjusted navigation spacing. Added a separator and Minha conta below navigation, reusing the existing name/email disclosure and local logout on desktop and mobile. No account page or new API was introduced.
- Company selection now submits automatically on change through the existing validated native POST. Removed confirmation buttons, retained pending/disabled feedback and duplicate prevention, and skipped unchanged selections. Backend membership verification and full-document cache reset remain intact.
- Passed npm test (355 tests across 28 files), TypeScript, ESLint (existing unused Logo warning only), production build and npm run test:auth:browser with the isolated mock API. Chrome verified immediate native POST switching, sidebar width, mobile account access, keyboard/modal behavior and existing authentication/onboarding flows. Desktop and mobile drawer screenshots were visually inspected. Positive real-backend integration limitations remain unchanged; F09 was not started.
