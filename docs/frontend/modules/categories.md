# Categories

## Endpoints
- GET `/companies/{companyId}/categories` → `CategoryResponseDto[]`.
- POST same path → `{name}` and `CategoryResponseDto` (201).
- PATCH `/companies/{companyId}/categories/{categoryId}` → `{name?}`.
- DELETE same path → 204, empty response; ADMIN-only according to operation description; may 409 if products are associated.

## UI
Company-context category list with create/edit dialogs, loading/empty/error, validation for name required at creation, 403/404/409 feedback. Confirm user permissions before enabling management controls, but backend remains authoritative. No undocumented category-by-ID endpoint. Invalidate categories and dependent product selection on changes.
