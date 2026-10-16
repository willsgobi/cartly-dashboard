# Coding standards

- TypeScript strict; no `any` without justification. Component PascalCase; functions/variables camelCase; files consistent within each feature; prefer explicit domain names.
- Use SCSS Modules for local styles, no inline visual style objects unless justified; isolate CSS variables/tokens centrally.
- Use React Hook Form + Zod for forms once installed. Derive field-level constraints from verified schemas and business rules, not assumed backend quirks. Client-side validation improves UX, never substitutes backend validation.
- Compose small typed components. Prefer plain React patterns to abstractions without a concrete repeated use case.
- No secrets in `NEXT_PUBLIC_*`. Expose only public API base URL there, when appropriate.
- No hard-coded mocked access tokens or production API response defaults. Mocks must be clearly confined to tests/stories.
- Proper encoding, error boundaries, retry policies where safe; never retry mutations blindly.
- Accessibility: semantic HTML, labels, focus management for dialogs, status messages with suitable live regions.
- Avoid duplicate state; derive from source when possible. Handle race conditions on changing company/filter/route.
- Use `npm` scripts actually present; before adding packages or changing scripts, explain why.
