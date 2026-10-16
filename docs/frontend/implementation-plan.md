# Cartly Dashboard — implementation plan

## Protocol
One task at a time, in the order of dependencies. `TODO` → `IN PROGRESS` → `DONE` only with acceptance evidence. Do not implement unsupported modules or undocumented endpoints.

| ID | Task | Depends on | Acceptance | State |
|---|---|---|---|---|
| F01 | Inspect/migrate starter styling and set Inter, global SCSS tokens and UI primitives | — | App builds; no accidental Tailwind/Geist remnants; responsive Input/Button with keyboard states | DONE |
| F02 | Typed API client, environment config and error mapping | F01 | Real OpenAPI paths/DTOs, authorization forwarding design documented and testable | DONE |
| F03 | Authentication, HttpOnly JWT session management and protected route foundation | F02 | Documented BFF; bounded cookie lifetime; server guards; 401 invalidation; 403 preservation; CSRF and tests | DONE |
| F04 | Registration and activation screens | F01,F02 | POST register/activate/resend; 8-digit OTP, loading/errors | DONE |
| F05 | Login/logout-local and route protection | F02,F03 | documented login; session handling and protected layout; tests | TODO |
| F06 | Companies list and active-company selection | F05 | GET /companies; zero/one/multiple-company behavior; isolation | TODO |
| F07 | Company onboarding form + address | F06 | POST /companies; nested address matches CreateCompanyDto | TODO |
| F08 | Dashboard shell/sidebar/mobile nav | F06 | accessible responsive layout with active-company context | TODO |
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
