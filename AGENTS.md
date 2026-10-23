
# Venduzily Dashboard — Agent Instructions

## Project Overview

Venduzily Dashboard is an administrative web application
built with Next.js, React, TypeScript, and SCSS Modules.

This repository contains only the administrative dashboard.

Do not implement the customer storefront or POS
(Point of Sale) unless explicitly requested.

## Before Implementing

Before starting any task:

1. Read `docs/frontend/architecture.md`.
2. Read `docs/frontend/coding-standards.md`.
3. Read `docs/frontend/design-system.md`.
4. Read `docs/frontend/implementation-plan.md`.
5. Read the documentation relevant to the requested module.
6. Inspect the existing implementation before modifying it.

Follow the existing project conventions.

## Implementation Rules

- Implement only one requested task at a time.
- Do not implement unrelated features.
- Use TypeScript with strict type safety.
- Prefer reusable components.
- Use SCSS Modules for component styling.
- Use React Hook Form and Zod for form validation.
- Follow the documented architecture.
- Avoid unnecessary dependencies.
- Do not duplicate existing components or logic.
- Keep user-facing text in Brazilian Portuguese (pt-BR).
- Write code, identifiers, and technical documentation in English.

## API Integration

The OpenAPI specification is available at:

`docs/contracts/venduzily-openapi.json`

Before integrating an endpoint:

1. Verify that the endpoint exists.
2. Verify its HTTP method and parameters.
3. Follow the documented request and response schemas.
4. Handle loading, error, and empty states.
5. Respect authentication and authorization requirements.

Never invent API endpoints, fields, or response structures.

Consult:

- `docs/frontend/api-integration.md`
- `docs/frontend/authentication.md`
- `docs/frontend/open-questions.md`

## Business Rules

Business rules and authorization references are located at:

`docs/backend-reference/`

The backend is the source of truth for business rules
and authorization.

Frontend validation improves user experience but
must never replace backend validation.

Never assume that access to a resource is authorized
only because its ID is known.

Always respect the active company context.

## Design System

Follow `docs/frontend/design-system.md`.

- Use the Venduzily color palette.
- Use Inter as the primary font.
- Maintain consistent spacing and typography.
- Reuse existing UI components.
- Support responsive layouts.
- Follow accessibility best practices.

Do not introduce unrelated visual patterns.

## Testing and Validation

Follow `docs/frontend/testing-strategy.md`.

After implementing a task:

1. Run the relevant tests.
2. Run TypeScript validation.
3. Run ESLint.
4. Verify the affected functionality.
5. Report any failures or unresolved issues.

Never claim tests passed unless they were executed.

## Task Completion

After completing a task, provide:

1. Summary of changes.
2. Files created or modified.
3. Tests and checks performed.
4. Remaining issues or blockers.
5. Suggested next task.

Do not automatically start the next task.

## Important Constraints

- Do not modify backend contracts.
- Do not invent business rules.
- Do not bypass authorization.
- Do not modify unrelated modules.
- Do not refactor working code without justification.
- Ask for clarification when essential information
  is missing and cannot be verified in the repository.

## Git Commit Guidelines

After completing each implementation task, suggest a Git commit
message following the Conventional Commits specification.

Format:

<type>(<scope>): <short description>

Allowed types:
- feat: New functionality
- fix: Bug fix
- refactor: Code restructuring without behavior changes
- style: Styling or visual changes
- test: Adding or updating tests
- docs: Documentation changes
- chore: Maintenance and configuration

Rules:
- Write commit messages in English.
- Use the imperative mood.
- Keep the subject concise and descriptive.
- Base the message on actual changes made.
- Suggest only one commit message per completed task.
- Do not create a commit automatically.
- Do not execute git add, git commit, or git push.
- Do not stage or modify Git history.
- The user is responsible for reviewing and committing changes manually.

Include the following section in every task completion report:

### Suggested Git Commit

`<type>(<scope>): <short description>`
