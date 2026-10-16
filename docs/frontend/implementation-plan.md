# Cartly Dashboard — implementation plan

## Protocol
One task at a time, in the order of dependencies. `TODO` → `IN PROGRESS` → `DONE` only with acceptance evidence. Do not implement unsupported modules or undocumented endpoints.

| ID | Task | Depends on | Acceptance | State |
|---|---|---|---|---|
| F01 | Inspect/migrate starter styling and set Inter, global SCSS tokens and UI primitives | — | App builds; no accidental Tailwind/Geist remnants; responsive Input/Button with keyboard states | DONE |
| F02 | Typed API client, environment config and error mapping | F01 | Real OpenAPI paths/DTOs, authorization forwarding design documented and testable | TODO |
| F03 | Confirm secure JWT storage/session design | F02 | Security decision documented; no token in localStorage by default; 401 handling | BLOCKED: session details |
| F04 | Registration and activation screens | F01,F02 | POST register/activate/resend; 8-digit OTP, loading/errors | TODO |
| F05 | Login/logout-local and route protection | F02,F03 | documented login; session handling and protected layout; tests | BLOCKED: F03 |
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
