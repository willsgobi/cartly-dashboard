# HTTP API integration — contract-first

## Source of truth
Read `docs/contracts/cartly-openapi.json` (OpenAPI 3.0, Cartly API v1.0); backend reference docs are in `docs/backend-reference/`. This snapshot contains **24 operations over 17 paths and 29 component schemas**. The old backend `api.md` is an incomplete prose summary, not an alternative endpoint source. The contract declares no `servers` URL: set environment-specific base URL explicitly.

## Rules
- Centralized typed HTTP adapter; bearer JWT on operations marked `security: [{bearer: []}]`.
- Match URL parameter placement exactly: e.g. products are under `/products` with company ID as query or body, while categories live under `/companies/{companyId}/categories`.
- No undocumented endpoints. Parse errors by status (400, 401, 403, 404, 409, 500) only where specified; messages may vary; preserve error states.
- Do not assume all responses share an envelope or pagination; list endpoints return arrays as documented.
- Keep transport DTOs generated from or manually aligned to the OpenAPI schema; avoid unchecked casts.
- Schema ambiguities are detailed in `open-questions.md` and must be resolved before affected implementations.

## Operation inventory
| Method | Path | Request schema | Documented success response schema | Authorization |
|---|---|---|---|---|
| `GET` | `/` | — | — | Public/not declared |
| `POST` | `/auth/register` | RegisterDto | 201:SafeUserResponseDto | Public/not declared |
| `POST` | `/auth/login` | LoginDto | 200:LoginResponseDto | Public/not declared |
| `POST` | `/auth/activate-account` | OtpDto | 200:SafeUserResponseDto | Public/not declared |
| `POST` | `/auth/resend-activation` | EmailDto | 200:GenericMessageResponseDto | Public/not declared |
| `POST` | `/auth/forgot-password` | EmailDto | 200:GenericMessageResponseDto | Public/not declared |
| `POST` | `/auth/reset-password` | ResetPasswordDto | 200:SafeUserResponseDto | Public/not declared |
| `GET` | `/companies` | — | 200:CompanyListResponseDto[] | JWT |
| `POST` | `/companies` | CreateCompanyDto | 201:CompanyResponseDto | JWT |
| `GET` | `/companies/{companyId}` | — | 200:CompanyDetailsResponseDto | JWT |
| `PATCH` | `/companies/{companyId}` | UpdateCompanyDto | 200:CompanyDetailsResponseDto | JWT |
| `PATCH` | `/companies/{companyId}/address/{addressId}` | UpdateCompanyAddressDto | 200:CompanyDetailAddressResponseDto | JWT |
| `POST` | `/companies/{companyId}/categories` | CreateCategoryDto | 201:CategoryResponseDto | JWT |
| `GET` | `/companies/{companyId}/categories` | — | 200:CategoryResponseDto[] | JWT |
| `PATCH` | `/companies/{companyId}/categories/{categoryId}` | UpdateCategoryDto | 200:CategoryResponseDto | JWT |
| `DELETE` | `/companies/{companyId}/categories/{categoryId}` | — | — | JWT |
| `POST` | `/products` | CreateProductDto | 201:ProductResponseDto | JWT |
| `GET` | `/products` | — | 200:ProductResponseDto[] | JWT |
| `GET` | `/products/{productId}` | — | 200:ProductResponseDto | JWT |
| `PATCH` | `/products/{productId}` | UpdateProductDto | 200:ProductResponseDto | JWT |
| `DELETE` | `/products/{productId}` | DeleteProductDto | — | JWT |
| `POST` | `/products/{productId}/variants` | CreateProductVariantDto | 201:ProductVariantResponseDto | JWT |
| `PATCH` | `/products/{productId}/variants/{productId}/variants/{variantId}` | UpdateProductVariantDto | 200:ProductVariantResponseDto | JWT |
| `DELETE` | `/products/{productId}/variants/{variantId}` | — | — | JWT |

## Specific contract notes
- `PATCH /products/{productId}` body `UpdateProductDto` **requires `companyId`**.
- `DELETE /products/{productId}` **requires JSON body** `DeleteProductDto` with `companyId`; HTTP client must support deletion with a body.
- `GET /products` requires `companyId` query and returns active products.
- `POST /products` requires `companyId` **in the body**, with `categoryId`.
- `POST /products/{productId}/variants` requires `companyId` query.
- The OpenAPI route for variant PATCH is suspicious: `/products/{productId}/variants/{productId}/variants/{variantId}`. Do not normalize without backend confirmation.
- Category DELETE returns 204 without body; product DELETE returns 200 with message.
- Swagger monetary schema types for some `price` request/response properties are `object`, but examples are numeric; confirm actual runtime representation and fix backend OpenAPI schema before relying on generated types.
