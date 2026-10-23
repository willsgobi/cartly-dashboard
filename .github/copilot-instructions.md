# Venduzily Dashboard — permanent Copilot instructions

- Follow `AGENTS.md` and `.github/agents/venduzily-frontend.agent.md` when selected.
- Read `docs/frontend/architecture.md`, `coding-standards.md`, `design-system.md`, `authentication.md`, `api-integration.md`, `testing-strategy.md` and relevant `modules/*.md` before touching a feature.
- Source of truth for endpoint paths, bodies, schemas and documented status codes: `docs/contracts/venduzily-openapi.json`. Business invariants: `docs/backend-reference/business-rules.md`, permissions: `docs/backend-reference/authorization.md`.
- `docs/frontend/open-questions.md` tracks ambiguities; do **not** silently resolve contracts, invent backend behavior or use non-existent endpoints.
- Keep changes scoped to one task from `docs/frontend/implementation-plan.md`. Inspect existing code first; avoid unrelated rewrites and new dependencies without justification.
- Always handle loading, empty, success, validation and network-error states; company isolation, access controls, responsiveness and keyboard accessibility.
- Type-check, lint, test as relevant, and report commands, outcomes, changed files and unresolved blockers. Never claim unrun checks succeeded.
- Frontend permissions only affect UI; backend authorization remains mandatory.
