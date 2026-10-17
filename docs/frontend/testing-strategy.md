# Testing strategy

## Tools
- Vitest is installed for API unit tests in F02; run with npm test. Type-level assertions and negative compile-time examples also require npx tsc --noEmit --incremental false.
- React Testing Library, `@testing-library/user-event` and jsdom are installed for F04 form tests. Tests use Vitest assertions; jest-dom is not installed. npm test includes features/**/*.test.ts and features/**/*.test.tsx; component files use the jsdom environment.
- MSW (optional, not installed) to mock API at network boundary using **actual documented** contracts.
- Playwright (not installed) for critical end-to-end flows, preferably with a controlled test API environment.
- TypeScript, ESLint and Next.js build for static checks.
- F03 adds mocked auth tests and npm run test:auth:production (after npm run build), which starts/stops a local production Next.js server and isolated mock API to verify protected rendering and cookie/CSRF behavior without contacting a real backend.
- F04 tests mock the Server Action boundary in form tests and native Fetch in action tests. They cover required/email/password confirmation/OTP validation, paste and leading zeros, DTO stripping, errors, safe messages, loading, duplicate submissions and navigation. Actual backend checks use only invalid/missing payloads or an unknown synthetic email; successful mailbox/OTP verification requires a controlled test account.
- F05 adds login form tests and browser BFF adapter tests, retaining the F03 session/guard/401/403/redirect coverage. After npm run build, npm run test:auth:browser extends the production suite with actual Chrome cookie persistence, full navigation, native logout and history isolation. Set CHROME_PATH if Chrome is not at the default Windows installation path. Real-account success is reported separately from the isolated mock-backed browser checks; never commit or print real credentials/tokens.
- F06 adds company preference, form, context-scope and workspace tests plus authenticated selection-handler tests. The existing production/Chrome suite now checks zero/one/multiple companies, native switching, verified refresh restoration, removed preferences, full document cache reset, the protected onboarding boundary and logout/new-session isolation. No live account or company mutation is used.
- F07 adds onboarding schemas, rate limiter, external lookup handlers, creation/synchronization handlers, browser BFF adapter and two-step form tests. All external Fetch calls are mocked. Chrome intercepts local lookup responses for manual-fallback checks, then exercises the actual creation BFF against isolated mock NestJS and verifies active selection, dashboard navigation/refresh and responsive widths. Public APIs and live accounts are never required by automated tests.
- F08 adds layout/navigation/mobile-drawer/account-disclosure tests and display-profile integrity/isolation/cleanup tests. jsdom stubs native dialog methods only for component tests; the existing production Chrome suite verifies real modal focus/inert background, Escape/overlay/navigation close, trigger focus restoration, profile/JWT HttpOnly behavior, welcome after refresh and responsive screenshots. The production HTTP suite checks one authoritative company read per layout/page request; no live API or new browser dependency is needed.

## Test pyramid

F09 adds category service/BFF, browser adapter, protected workspace and CRUD component tests. Fetch/adapter boundaries are mocked; no live mutation is used. The production Chrome suite exercises the actual category BFF with mock NestJS, including 204, duplicate/linked-product 409, 403 preservation, 401 cleanup, company switching, modal focus/Escape and responsive screenshots. Product/permission APIs remain outside the test fixture inventory.
- Unit: formatters, schema refinements (NORMAL/VARIANT/VARIANT_WITH_PRICE), company-scoped query builders, error mapping.
- Components: inputs and validation, disabled/loading/error states, keyboard interactions.
- Integration: login/onboarding, company switch cache invalidation, list/create/edit/delete products and category restrictions with realistic mocked responses.
- E2E: auth flow; zero-company onboarding; multi-company switching; create/edit product; permission/401/403 flows when supported by the API test environment.

F10 adds product schema, service/BFF, browser adapter, protected workspace and CRUD/filter/detail tests. Compatibility type tests retain raw Swagger ambiguity while proving numeric product request support and rejecting object-valued prices. Existing F09 tests verify extracted shared transport/company checks. Production Chrome checks actual product BFF requests against isolated mock NestJS, numeric NORMAL creation, partial edits, existing variants, soft DELETE with JSON body, responsive list/form, company isolation and 401/403 behavior; no variant mutation endpoint is allowed by the fixture inventory.

## Definition of done
Task acceptance criteria met; lint and TS pass; tests covering introduced logic pass; inspect accessibility and mobile behavior; no invented endpoints; document known failures. Add test scripts when tooling installed, not before. Isolate fixtures and never use live production data.
