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
- PATCH `/products/{productId}/variants/{variantId}?companyId=...` updates optional name/price fields. F12 uses the corrected user-supplied snapshot and regenerated types.

## Acceptance
F10 implements listing, detail, safe partial editing and soft deletion. F11 extends creation to all three types, adds variants to existing products and physically deletes variants. F12 edits existing variants through the corrected PATCH contract. Display existing variants/images from documented responses, without image uploads or unsupported operations. Handle safe 400/401/403/404/409/500/network failures and prevent invalid type/variant combinations. Company-switch data must not leak across contexts.

## F10 structure and UI

- /dashboard/products uses the existing dashboard layout and authoritative request-scoped company context. Zero companies reuse onboarding. Without a verified active selection, no product/category requests are made.
- ProductsManager displays names, category, type, BRL price or a per-variant price indication, and compact details/edit/delete controls. Name search and category/type filters operate locally over the retrieved arrays; no invented API query parameters or pagination. Copy avoids repeating the company name. Loading, empty, no-filter-results, independent category failure, error/retry and success states are provided.
- ProductDialog reuses the native Modal and obtains fresh GET detail data before editing. ProductForm uses RHF/Zod and existing Input/Button, validates trimmed nonempty names, active-company category membership and finite positive prices, and accepts comma/dot decimal input. F11 extends this same form with initial variants as described below; NORMAL sends no variants array. Existing types remain read-only during editing. VARIANT shared price and metadata can be edited; VARIANT_WITH_PRICE metadata can be edited with null product price and untouched variant prices. Inconsistent existing configurations cannot be edited until their invariants are repaired through details.
- Unchanged edits close without PATCH; changed fields alone are sent. Failures preserve form values. Mutations block duplicate submissions and dismissal, and pending work is aborted on unmount. Successful commits close, announce success, focus the creation control and refresh the list; retry after a failed refresh cannot repeat a mutation. F06's keyed scope/full document company switch discards filters, dialogs, data and pending work.
- Details display optional description/category/images safely, timestamps in pt-BR with a fixed timezone, all returned variants, and individual prices for VARIANT_WITH_PRICE. Only absolute HTTP(S) image URLs render, with lazy loading and no-referrer. No image optimizer proxy or image upload/delete endpoint is added. F11 creation/deletion and F12 variant editing are integrated into this same view.
- DeleteProductDialog explicitly confirms removal from the active listing and preservation of related records. The service sends exactly {companyId} in the upstream DELETE JSON body and handles the documented 200. Its response schema has only an example, so raw diagnostics/message text are not treated as a required UI contract. The BFF returns its own fixed {deleted:true} acknowledgement. There is no physical deletion of products, variants or images.

## API boundary and reuse

features/products/service.ts uses F02/F03 authenticatedRequest for the five existing product operations. GETs use companyId query, POST/PATCH use the server-derived companyId in JSON, DELETE uses its required JSON body. Product responses are decoded from unknown and checked for company/product/category/variant scope. JWTs never reach Client Components, and all requests/responses are no-store.

Fixed local routes GET/POST /api/products and GET/PATCH/DELETE /api/products/[productId] validate the session and active company independently on every operation. lib/companies/active-request.ts extracts F09's existing verification for both features: freshly fetch accessible companies, verify the session-bound preference and reject a mismatched rendered scope. Client company IDs are not authorization. POST/PATCH reuse F09 listCategories to verify category membership; PATCH checks the fresh existing product and final invariants before forwarding. Origin/CSRF and bounded JSON protections are unchanged. Unknown mutation fields and client companyId are rejected; initial variants are accepted only in type-valid product creation, never in product PATCH.

lib/api/browser-request.ts extracts F09's same-origin transport for both adapters; the central NestJS HTTP client is not duplicated. Existing 401 cleanup redirects to safe login returns and clears session/company/display cookies. 403 preserves the session. The contract supplies no role/permission matrix: controls permit explicit requests and handle backend denials, without assuming ADMIN or inventing a permission endpoint.

## Explicit runtime compatibility and remaining contract differences

The F10 request explicitly authorizes validated numeric/null form models while preserving the OpenAPI snapshot. Read-only inspection of the local NestJS checkout (HEAD 8c14c03, no backend changes made) established:

- src/modules/products/application/dto/create-product.dto.ts and update-product.dto.ts declare price as number|null with IsNumber, and use cases enforce greater-than-zero product/variant prices for the relevant types.
- infrastructure/repositories/prisma-product.repository.ts converts nullable Prisma decimals to Number in list/detail/create/update responses. prisma/schema.prisma declares Decimal? with no explicit application scale. No unverified precision limit, rounding or numeric-string response coercion is introduced.
- presentation/dto/product-response.dto.ts declares numeric/null product prices and an embedded variant with id/name/price, while the snapshot also requires variant productId/timestamps. Runtime variant metadata is therefore optional in the validated application model; any supplied productId must match the parent. Optional/null description, category and images are handled defensively. No unrecognized fields are displayed.

lib/api/product-compatibility.ts explicitly derives product/variant Create and Update request models from generated DTOs with price replaced by number|null, including nested initial variant prices. lib/api/types.ts applies these overrides solely to POST /products, PATCH /products/{productId} POST /products/{productId}/variants and PATCH /products/{productId}/variants/{variantId}; all other operation/path/query constraints remain generated. Raw generated field types remain unchanged; path types were regenerated from the user-supplied corrected snapshot for F12. Services decode unknown responses into validated application models, without assertions, object-valued monetary form fields or broad transport escape hatches. This compatibility is based on inspected source, not Swagger examples, and is not a claim of deployed runtime validation.

An additional inconsistency remains: the snapshot marks create description optional, but the local create DTO applies IsString/IsNotEmpty without IsOptional, the database requires it, and update validation rejects empty descriptions. F10 preserves the requested optional contract (omits blank create description, never invents content), preserves form values on 400 and leaves this mismatch visible here. Supply a nonempty description for the inspected backend; reconcile its OpenAPI/validation separately. F12 uses the corrected variant PATCH path supplied by the user and regenerated types.

## Verification and limits

Automated tests mock Fetch/BFF adapters and cover monetary models, all type invariants, exact company placement/DELETE JSON, membership/CSRF/session checks, foreign data/category rejection, safe status mapping, NORMAL creation, optional fields, read-only variants, fresh detail editing, unchanged/partial edits, local filters, duplicates/pending states, deletion confirmation, failed refresh after commit and company teardown. The production Chrome suite exercises the actual BFF against isolated mock NestJS, including NORMAL create/edit, numeric BRL, details with variants, logical deletion, 403 preservation, 401 cleanup, company isolation and responsive screenshots.

No activated real test account was supplied. Source inspection and mock-backed success do not establish positive authenticated live-NestJS behavior. No real product/category was mutated and no NestJS backend code was edited. The corrected F12 snapshot was supplied by the user, not silently normalized by the frontend implementation.

## F11 creation and variant lifecycle

The existing ProductForm uses a type-discriminated schema for initial creation, with useFieldArray IDs as React keys and shared VariantFields controls. Each row has stable accessible input IDs, inline errors and an explicit removal action. At least one row is required for both variant-based types. Editing remains separate from initial-row validation and does not submit existing variant records.

- NORMAL: show a positive product price; omit variant records entirely.
- VARIANT: show a positive shared product price; require named variants and normalize every submitted variant price to null.
- VARIANT_WITH_PRICE: product price is null, with named variants and a positive individual price for each.

Switching types retains rows and all entered price text in RHF. A visible explanation describes preservation and hidden-field normalization; switching to NORMAL hides rows without discarding them. Wire payloads are built from validated applicable fields and checked again by the discriminated BFF schema. Hidden stale prices cannot influence another pricing strategy.

prices.ts normalizes decimal text and checks that conversion to the API's finite positive JSON number preserves its canonical decimal representation. It rejects lossy values such as 9007199254740993 and 0.10000000000000001 rather than silently rounding, accepts comma/dot decimals and trailing zeros, and performs no monetary calculations. No invented fixed scale, currency conversion or rounding policy is introduced; deployed precision policy still requires contract clarification.

VariantManagement extends ProductDetails with add and delete controls for variant-based products only. The add form reuses VariantFields, follows the product's current pricing strategy and maps duplicate-name 409 safely. Delete opens explicit confirmation within the existing native details dialog, identifies the variant, states physical/permanent deletion and focuses Cancel. Pending mutations disable competing controls and parent-dialog dismissal. Failures retain inputs/confirmation; 401 uses existing cleanup/login handling and 403 preserves the session.

Fixed BFF routes POST /api/products/[productId]/variants and DELETE /api/products/[productId]/variants/[variantId] reuse existing origin/session/active-company verification. They read fresh product details, reject NORMAL, validate incoming prices according to its type and check the selected variant belongs to the returned product before deletion. F11 uses the documented POST/DELETE variant endpoints with companyId query; DELETE sends no body. F12 extends the same service with the documented PATCH. There is no separate variant listing endpoint. Unknown success message bodies are not rendered as UI text.

After a committed mutation, the details stay open and announce success while GET details and the product list refresh. Stale details have disabled controls while refreshing; a failed refresh withholds stale management and offers GET-only retry without repeating the commit. F06 scope teardown aborts pending work and removes forms/confirmations; late results are ignored. The existing Modal received a small mobile close-button shrink fix for longer titles.

## Last-variant backend gap

Read-only inspection of src/modules/products/application/use-cases/delete-product-variant.use-case.ts and infrastructure/repositories/prisma-product.repository.ts found no remaining-count/invariant check before physical deletion. The use case verifies company/admin/product/variant ownership, then directly deletes; the repository directly calls productVariant.delete. Its existing tests do not establish a last-variant guard. This source behavior permits an inconsistent empty variant-based product, and no protection is claimed for a deployed backend without live verification.

F11 does not invent a server restriction. It warns explicitly when the confirmed target is the last variant and allows the documented deletion. If the refreshed product has an empty array, details display an inconsistency message and keep Add available to restore a variant. Backend enforcement must be addressed separately, including concurrent deletions; the frontend cannot guarantee the invariant. F12 does not change deletion behavior.

## F12 partial variant updates

After the user supplied the corrected local contract on 2026-10-18, npm run api:generate regenerated the path types. The route agrees with the inspected NestJS controller. UpdateProductVariantDto still describes optional object-valued price despite numeric/null runtime DTOs; ProductVariantUpdateRequest extends the existing explicit compatibility policy only for this operation. Raw generated field types remain untouched and api:check verifies generation fidelity.

VariantManagement reuses its existing RHF/Zod form and VariantFields for both add and edit. Each applicable variant has an Edit action opening the existing native Modal with current values and initial input focus. NORMAL has no controls. VARIANT edits only name, with no editable price and no price key sent; its shared product price is preserved. VARIANT_WITH_PRICE edits name and/or a finite positive individual price using the existing decimal parser. No product-level field is submitted. Only changed fields are PATCHed; unchanged values close the edit modal without a request.

PATCH /api/products/[productId]/variants/[variantId] reuses session, Origin/CSRF, bounded JSON, active-company and fresh parent verification. The target must belong to the verified product. NORMAL, unknown fields, empty DTOs and any supplied price for VARIANT are rejected. Final pricing invariants are checked before forwarding to the documented NestJS PATCH with both path parameters and companyId query. Runtime response decoding validates variant and product IDs. There is no new client, proxy abstraction, role assumption or permission endpoint.

The child edit modal closes only on success or explicit idle dismissal. Failed updates preserve all values and keep it open. Pending state prevents duplicates and locks parent/child dismissal. Native modal stacking keeps the details inert; Escape is handled only by the targeted dialog, so it closes editing without closing details. Focus returns to its Edit trigger after cancel/unchanged/success, waiting for refresh when needed. The shared Modal cancel handler now ignores bubbled cancellation from child dialogs.

Successful PATCH reuses F11's success announcement and detail/list GET refresh without application reload or company changes. Controls remain disabled while refreshing. Failed refresh offers GET-only retry without replaying the update. Company-scope teardown aborts PATCH/GET work, removes the edit modal and ignores late results. Existing 401 cleanup/login behavior and 403 session preservation remain intact. The documented PATCH statuses are 200/400/401/403/404; mocks also inject unexpected failures to verify generic safe handling, without claiming those statuses were observed live.

Tests cover visibility/prefill, name-only/price-only/combined DTOs, unchanged skip, shared-price protection, validation, 400/401/403/404, duplicate blocking, nested Escape/focus, company teardown/late success, malformed responses and refresh failure. Chrome exercises the real production BFF against isolated mock NestJS, verifies the corrected URL, shared-price preservation, individual updates, reload persistence, 403/401, nested native dialog behavior and mobile screenshot. Positive live NestJS updates were not executed: no authorized activated test-account credentials were supplied. Existing description/monetary/permission-source and last-deletion questions remain documented; F13 is not implemented.

F11 unit/component tests cover all creation combinations, stable dynamic rows, hidden-value preservation/normalization, decimal round trips, exact POST/DELETE/query/body contracts, fresh scope checks, last deletion/empty recovery, duplicate and permission errors, locked pending operations, GET-only refresh retries and abort on company change. Production Chrome exercises both initial strategies and add/delete through the actual BFF with isolated mock NestJS, including 409/403/401 and last-variant recovery. Positive live backend mutations were not performed because no authorized activated test-account credentials were supplied.
