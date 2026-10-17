# Categories

## Endpoints
- GET `/companies/{companyId}/categories` → `CategoryResponseDto[]`.
- POST same path → `{name}` and `CategoryResponseDto` (201).
- PATCH `/companies/{companyId}/categories/{categoryId}` → `{name?}`.
- DELETE same path → 204, empty response; ADMIN-only according to operation description; may 409 if products are associated.

## F09 interface

The protected /dashboard/categories route reuses the F08 dashboard layout, request-scoped authoritative company context and F06 provider. Zero companies redirect to existing onboarding; multiple companies without a verified selection show a selection prompt without fetching category data. The sidebar and header identify Categories as the active module.

CategoriesManager lists names and creation dates (pt-BR, America/Sao_Paulo), with loading, empty, error/retry and success feedback. CategoryForm shares React Hook Form/Zod validation between creation and editing, trims surrounding whitespace, requires a nonempty name and skips unchanged edits. No length limit or extra editable field is invented. DeleteCategoryDialog identifies the category, explains permanent deletion and linked-product restrictions, focuses Cancel initially and requires an explicit confirmation. Duplicate submissions and dismissal during mutations are blocked; failed requests preserve the form/dialog.

The reusable components/ui/Modal uses native dialog.showModal for inert background/focus containment. Escape, close and backdrop dismiss idle dialogs; scroll is restored on unmount, and focus returns to the invoker or the creation control. Successful mutations close the dialog, announce success and refresh the list without changing company. A failed refresh cannot repeat a committed mutation; its retry is GET-only.

Category copy avoids repeating the company name already shown in the header. The create/edit/delete list controls use local compact styles (36px minimum height and smaller type/padding), retaining 44px minimum touch targets for coarse pointers. Other modules keep their existing button sizing.

## API and authorization boundary

- service.ts is server-only and uses the F02/F03 authenticated client and OpenAPI-derived DTOs. Runtime decoders reject malformed/missing responses, invalid dates, foreign-company DTOs and mismatched update IDs. UpdateCategoryDto keeps its optional name field; the editing form submits only a changed name. DELETE sends no body and accepts the documented empty 204 response.
- Local fixed-operation BFF routes are GET/POST /api/categories and PATCH/DELETE /api/categories/[categoryId]. They accept no upstream URL or arbitrary method/path. Every operation validates the session, fetches the accessible company list, and resolves the existing session-bound selection cookie. The browser's companyId query must match that verified active selection; it is only a stale-document check, never proof of authorization. Category permissions/ownership are independently enforced by NestJS.
- Mutations enforce the existing configured Origin/CSRF check and bounded JSON reader. JWTs remain server-only; requests/responses use no-store. The small browser adapter calls only these BFF routes with same-origin cookies. It does not duplicate the typed NestJS HTTP client or read browser token storage.
- 401 uses existing session/company/display-cookie cleanup and returns the user to login with a safe category return URL. 403 displays denial and preserves the session. 400/404/500/network failures use safe existing messages. Name conflicts map 409 to a duplicate-name message; deletion conflicts explain linked products. Raw backend diagnostics are never displayed or logged.

## Permission source limitation

The contract provides no user role, company permission matrix or permission endpoint. Therefore the interface cannot pre-confirm permissions or conditionally hide actions by role. Controls permit explicit requests, describe the administrator restriction for deletion and handle backend 403; their availability does not assert authorization. No ADMIN assumption or undocumented permission request is introduced. Conditional permission-based visibility remains dependent on a documented source, as recorded in open-questions.md.

## Company state and future consumers

The existing provider keys descendants by selected company and native company switching reloads the document. Unmount aborts pending reads/mutations, and aborted/late results cannot update the new company's UI. Retrying a list request cancels the previous read. No persistent category/product cache is introduced. Future product category selectors must refresh after mutations and key caches by identity/company; F10 is not implemented here.

## Validation

Vitest tests cover typed-service/BFF forwarding, exact DTOs, optional PATCH fields, empty DELETE, missing/expired sessions, CSRF, stale/foreign/removed/other-session selections, malformed responses, safe status mapping, form validation/preservation, unchanged edits, pending/duplicate prevention, cancellation, refresh failure after commit and company teardown. The production Chrome suite verifies actual same-origin CRUD, 409/403/401 handling, modal focus/Escape, protected navigation and company isolation using an isolated mock API. Screenshots at desktop/mobile sizes are visually inspected and overflow is checked at 320/390/768/1280px.

Positive real-NestJS integration requires an authorized activated test account; none was supplied. Automated mocks do not establish live permission behavior. No backend contract, product data or F10 implementation is changed.
