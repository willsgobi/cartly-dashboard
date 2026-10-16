# Testing strategy

## Recommended tools (not yet installed)
- Vitest + React Testing Library + `@testing-library/user-event` + jest-dom matchers for logic, forms and components.
- MSW (optional) to mock API at network boundary using **actual documented** contracts.
- Playwright for critical end-to-end flows, preferably with a controlled test API environment.
- TypeScript, ESLint and Next.js build for static checks.

## Test pyramid
- Unit: formatters, schema refinements (NORMAL/VARIANT/VARIANT_WITH_PRICE), company-scoped query builders, error mapping.
- Components: inputs and validation, disabled/loading/error states, keyboard interactions.
- Integration: login/onboarding, company switch cache invalidation, list/create/edit/delete products and category restrictions with realistic mocked responses.
- E2E: auth flow; zero-company onboarding; multi-company switching; create/edit product; permission/401/403 flows when supported by the API test environment.

## Definition of done
Task acceptance criteria met; lint and TS pass; tests covering introduced logic pass; inspect accessibility and mobile behavior; no invented endpoints; document known failures. Add test scripts when tooling installed, not before. Isolate fixtures and never use live production data.
