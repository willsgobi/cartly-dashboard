# Products and variants

## Company and category isolation
A product always belongs to one company and a category of that same company. `POST /products` accepts companyId and categoryId in request **body**. `GET /products?companyId=...` lists active items; `GET /products/{productId}?companyId=...` fetches an active item. `PATCH /products/{productId}` requires companyId in body. `DELETE /products/{productId}` requires body `{companyId}` and is soft-delete, returning 200/message.

## Types and validation (source: backend business-rules.md)
- `NORMAL`: `Product.price` required and variants disallowed.
- `VARIANT`: `Product.price` required; ≥1 variant; every variant price null.
- `VARIANT_WITH_PRICE`: `Product.price` null; ≥1 variant; every variant has a price.
- Company/category mismatch forbidden. Schema must refine conditional fields; backend is authority.

## Variant endpoints
- POST `/products/{productId}/variants?companyId=...` with `CreateProductVariantDto`.
- DELETE `/products/{productId}/variants/{variantId}?companyId=...` physically deletes.
- PATCH route **currently malformed in supplied Swagger**; blocked until verified (`open-questions.md`).

## Acceptance
F10 implements listing, detail, NORMAL creation, safe partial editing and soft deletion. Variant mutations remain F11/F12. Display existing variants/images from documented responses, without image uploads or unsupported operations. Handle safe 400/401/403/404/409/500/network failures and prevent invalid type/variant combinations. Company-switch data must not leak across contexts.

## F10 structure and UI

- /dashboard/products uses the existing dashboard layout and authoritative request-scoped company context. Zero companies reuse onboarding. Without a verified active selection, no product/category requests are made.
- ProductsManager displays names, category, type, BRL price or a per-variant price indication, and compact details/edit/delete controls. Name search and category/type filters operate locally over the retrieved arrays; no invented API query parameters or pagination. Copy avoids repeating the company name. Loading, empty, no-filter-results, independent category failure, error/retry and success states are provided.
- ProductDialog reuses the native Modal and obtains fresh GET detail data before editing. ProductForm uses RHF/Zod and existing Input/Button, validates trimmed nonempty names, active-company category membership and finite positive prices, and accepts comma/dot decimal input. NORMAL is the only creation type; no variants array is sent. Existing types are read-only. VARIANT shared price and metadata can be edited; VARIANT_WITH_PRICE metadata can be edited with null product price and untouched variant prices. Inconsistent existing configurations cannot be edited until their invariants are repaired. No field requiring variant mutations is exposed.
- Unchanged edits close without PATCH; changed fields alone are sent. Failures preserve form values. Mutations block duplicate submissions and dismissal, and pending work is aborted on unmount. Successful commits close, announce success, focus the creation control and refresh the list; retry after a failed refresh cannot repeat a mutation. F06's keyed scope/full document company switch discards filters, dialogs, data and pending work.
- Details display optional description/category/images safely, timestamps in pt-BR with a fixed timezone, all returned variants, and individual prices for VARIANT_WITH_PRICE. Only absolute HTTP(S) image URLs render, with lazy loading and no-referrer. No image optimizer proxy, upload/delete endpoint or variant controls are added.
- DeleteProductDialog explicitly confirms removal from the active listing and preservation of related records. The service sends exactly {companyId} in the upstream DELETE JSON body and handles the documented 200. Its response schema has only an example, so raw diagnostics/message text are not treated as a required UI contract. The BFF returns its own fixed {deleted:true} acknowledgement. There is no physical deletion of products, variants or images.

## API boundary and reuse

features/products/service.ts uses F02/F03 authenticatedRequest for the five existing product operations. GETs use companyId query, POST/PATCH use the server-derived companyId in JSON, DELETE uses its required JSON body. Product responses are decoded from unknown and checked for company/product/category/variant scope. JWTs never reach Client Components, and all requests/responses are no-store.

Fixed local routes GET/POST /api/products and GET/PATCH/DELETE /api/products/[productId] validate the session and active company independently on every operation. lib/companies/active-request.ts extracts F09's existing verification for both features: freshly fetch accessible companies, verify the session-bound preference and reject a mismatched rendered scope. Client company IDs are not authorization. POST/PATCH reuse F09 listCategories to verify category membership; PATCH checks the fresh existing product and final invariants before forwarding. Origin/CSRF and bounded JSON protections are unchanged. Unknown mutation fields, including variants and client companyId, are rejected.

lib/api/browser-request.ts extracts F09's same-origin transport for both adapters; the central NestJS HTTP client is not duplicated. Existing 401 cleanup redirects to safe login returns and clears session/company/display cookies. 403 preserves the session. The contract supplies no role/permission matrix: controls permit explicit requests and handle backend denials, without assuming ADMIN or inventing a permission endpoint.

## Explicit runtime compatibility and remaining contract differences

The F10 request explicitly authorizes validated numeric/null form models while preserving the OpenAPI snapshot. Read-only inspection of the local NestJS checkout (HEAD 8c14c03, no backend changes made) established:

- src/modules/products/application/dto/create-product.dto.ts and update-product.dto.ts declare price as number|null with IsNumber, and use cases enforce greater-than-zero product/variant prices for the relevant types.
- infrastructure/repositories/prisma-product.repository.ts converts nullable Prisma decimals to Number in list/detail/create/update responses. prisma/schema.prisma declares Decimal? with no explicit application scale. No unverified precision limit, rounding or numeric-string response coercion is introduced.
- presentation/dto/product-response.dto.ts declares numeric/null product prices and an embedded variant with id/name/price, while the snapshot also requires variant productId/timestamps. Runtime variant metadata is therefore optional in the validated application model; any supplied productId must match the parent. Optional/null description, category and images are handled defensively. No unrecognized fields are displayed.

lib/api/product-compatibility.ts explicitly derives Create/Update request models from generated DTOs with only price replaced by number|null. lib/api/types.ts applies this override solely to POST /products and PATCH /products/{productId}; all other operation/path/query constraints remain generated. Generated response types and the snapshot remain unchanged. Services decode unknown product responses into the validated application model, without assertions, object-valued monetary form fields or broad transport escape hatches. This compatibility is based on inspected source, not Swagger examples, and is not a claim of deployed runtime validation.

An additional inconsistency remains: the snapshot marks create description optional, but the local create DTO applies IsString/IsNotEmpty without IsOptional, the database requires it, and update validation rejects empty descriptions. F10 preserves the requested optional contract (omits blank create description, never invents content), preserves form values on 400 and leaves this mismatch visible here. Supply a nonempty description for the inspected backend; reconcile its OpenAPI/validation separately. The malformed variant PATCH remains untouched and unused.

## Verification and limits

Automated tests mock Fetch/BFF adapters and cover monetary models, all type invariants, exact company placement/DELETE JSON, membership/CSRF/session checks, foreign data/category rejection, safe status mapping, NORMAL creation, optional fields, read-only variants, fresh detail editing, unchanged/partial edits, local filters, duplicates/pending states, deletion confirmation, failed refresh after commit and company teardown. The production Chrome suite exercises the actual BFF against isolated mock NestJS, including NORMAL create/edit, numeric BRL, details with variants, logical deletion, 403 preservation, 401 cleanup, company isolation and responsive screenshots.

No activated real test account was supplied. Source inspection and mock-backed success do not establish positive authenticated live-NestJS behavior. No real product/category was mutated, no backend/OpenAPI contract was edited, and F11/F12 were not started.
