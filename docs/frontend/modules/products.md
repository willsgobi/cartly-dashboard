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
Product listing, detail, create/edit forms and variants per explicit individual task. Display variants and images from documented response. Do NOT implement image uploads (no endpoint). Confirm monetary schema (`object` vs number) before coding price payloads. Handle 400, 401, 403, 404, 409 if operation documents them, and invalid type/variant combinations. Company-switch data must not leak across contexts.
