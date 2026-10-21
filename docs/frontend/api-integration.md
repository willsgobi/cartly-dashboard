# HTTP API integration — contract-first

F03 now provides the server-only cookie/BFF session boundary described in [session-management.md](session-management.md). F02 transport behavior below remains unchanged; its historical references to a future session task are superseded by that implemented decision.

## Source of truth
Read `docs/contracts/cartly-openapi.json` (OpenAPI 3.0, Cartly API v1.0); backend reference docs are in `docs/backend-reference/`. The corrected F12 snapshot contains **24 operations over 16 paths and 29 component schemas**. The old backend `api.md` is an incomplete prose summary, not an alternative endpoint source. The contract declares no `servers` URL: set environment-specific base URL explicitly.

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
| `PATCH` | `/products/{productId}/variants/{variantId}` | UpdateProductVariantDto | 200:ProductVariantResponseDto | JWT |
| `DELETE` | `/products/{productId}/variants/{variantId}` | — | — | JWT |

## Specific contract notes
- F17 uses the existing company GET/PATCH and address PATCH operations, with exact path parameters and partial DTOs. Local BFF queries verify the active scope only and are not forwarded to NestJS. UpdateCompanyAddressDto omits number, so it remains read-only. Company details/address responses are runtime-validated; no contract edits or new backend operation are introduced. See modules/company-settings.md.
- F13 reuses public Server Actions for POST /auth/forgot-password (EmailDto to GenericMessageResponseDto) and POST /auth/reset-password (ResetPasswordDto to SafeUserResponseDto). Both document 200/400. Inputs are validated server-side; confirmPassword is stripped, JWTs/cookies are not forwarded, and upstream requests are no-store. The UI uses fixed generic recovery feedback and never renders upstream messages. No reset-specific resend endpoint or session mutation is introduced.
- `PATCH /products/{productId}` body `UpdateProductDto` **requires `companyId`**.
- `DELETE /products/{productId}` **requires JSON body** `DeleteProductDto` with `companyId`; HTTP client must support deletion with a body.
- `GET /products` requires `companyId` query and returns active products.
- `POST /products` requires `companyId` **in the body**, with `categoryId`.
- `POST /products/{productId}/variants` requires `companyId` query.
- F12's user-supplied corrected snapshot documents PATCH /products/{productId}/variants/{variantId} with required companyId query. The inspected controller agrees; generated types were regenerated. The old duplicated route is not used.
- Category DELETE returns 204 without body; product DELETE returns 200 with message.
- Swagger monetary schema types for some `price` request/response properties are `object`, but examples are numeric; confirm actual runtime representation and fix backend OpenAPI schema before relying on generated types.


## F02 HTTP client

### Files and contract generation

- `lib/api/generated/schema.d.ts`: generated paths, operations and DTOs; do not edit manually.
- `lib/api/types.ts`: derives method/path combinations, required path/query parameters, JSON request bodies and success payloads from the generated contract.
- `lib/api/client.ts`: native Fetch transport; accepts an optional per-request token, cancellation signal, headers and response decoder.
- `lib/api/environment.ts`, `url.ts`, `errors.ts`: lazy configuration, URL serialization and UI-independent failures.

Run `npm run api:generate` after an authorized contract update. Commit the generated file alongside the contract change. Run `npm run api:check` to detect drift without rewriting the file. Generation uses [openapi-typescript](https://openapi-ts.dev/cli) as a development dependency and does not fetch a remote API.

The generated price declarations remain `Record<string, never> | null` (optional where specified); they are **not** converted to numbers from examples. Variant response prices remain `number | null`. F12 regenerated the corrected variant PATCH path. Two DELETE success schemas contain examples without property definitions, so their JSON bodies remain `unknown`; an example alone does not establish a response DTO. Monetary schema correction remains open; the explicit runtime compatibility below is based on inspected backend source.

F12 uses the corrected PATCH path, required productId/variantId path parameters and companyId query, and the optional name/price fields from UpdateProductVariantDto. The existing explicit numeric compatibility also covers this PATCH price after inspecting UpdateProductVariantDto/UpdateProductVariantUseCase in local NestJS. This preserves the raw generated object-valued monetary schema, with validated numeric application models. The fixed BFF rechecks company/parent membership, rejects NORMAL and any shared-price variant price field, validates final invariants and forwards only a partial DTO. Documented errors are 400/401/403/404; unexpected statuses use generic existing mappings without claiming new backend behavior.

F10 explicitly authorizes product numeric/null models. Inspected local NestJS DTOs and repository conversions establish that representation; lib/api/product-compatibility.ts now supplies a narrow price override for POST /products and PATCH /products/{productId} request options only. Generated response types remain untouched; F10 decodes unknown responses with numeric runtime schemas. This does not alter variant operations or infer a precision policy. See [modules/products.md](modules/products.md) for evidence, source/snapshot differences and live validation limits.

F11 extends that explicit numeric compatibility to initial CreateProductDto.variants prices and POST /products/{productId}/variants, based on the inspected CreateProductVariantDto and repository Number conversion. Variant deletion uses companyId query and no request body, returning 200 with an underspecified message example. Fixed variant BFF handlers verify current company/product scope before forwarding; no variant PATCH or separate list operation is introduced. Price text normalization checks JSON numeric round trips without monetary arithmetic or a guessed precision scale.

### Environment configuration

Copy `.env.example` to `.env.local` and replace `API_BASE_URL` with the actual development backend URL. In production, set the same variable in the deployment environment. Use the appropriate HTTPS endpoint for browser/public production traffic; HTTP is also supported for local development or private network deployments.

`getApiBaseUrl()` reads the server-side `API_BASE_URL` lazily; importing the module or building the foundation page does not contact the API or require a running backend. There is no development fallback in application code. Missing/invalid configuration throws `ApiError` with kind `configuration` when a caller initializes a client.

URLs must be absolute HTTP(S) URLs, without credentials, query strings or fragments. An optional base path such as `https://api.example.test/v1` is preserved for every request. Trailing slashes are normalized. The URL is not a secret, but no credentials, signing secrets or access tokens belong in environment examples.

`API_BASE_URL` is intentionally not prefixed with `NEXT_PUBLIC_`. Call `getApiBaseUrl()` from server code. The transport itself can run in the browser with an explicitly supplied public URL if a future task requires it; this task does not decide browser token access or deployment proxy/session architecture.

### Requests, decoding and empty responses

Use `createApiClient({ baseUrl: getApiBaseUrl() })` in server code. The public method is `request(method, pathTemplate, options)` with GET, POST, PATCH and DELETE. Only combinations and fields present in the contract compile. Required company context stays in its documented path, query or JSON body location.

`pathParams` values are encoded as individual path segments; every occurrence of a repeated placeholder is replaced. Query serialization uses URLSearchParams, preserving reserved characters through encoding. The low-level serializer supports strings, finite numbers, booleans and repeated keys for arrays; null/undefined values are omitted and empty strings are retained. Public request types still permit only the parameters actually declared for that operation.

JSON request bodies are serialized and receive `Content-Type: application/json`; absent bodies do not. JSON response data starts as `unknown`. Supply `decode(value: unknown)` to validate and return the documented success type; a throwing decoder produces `invalid-response`. Generated types alone are not runtime validation. Without a decoder, the result stays `unknown` and must be narrowed before use.

HTTP 204 and successful empty/whitespace bodies resolve to `undefined` without calling the decoder. Typed results therefore include `undefined`; callers must handle missing data. JSON `null` remains null. Malformed nonempty JSON on a successful response produces `invalid-response`.

Example of a typed GET with runtime validation (illustrative caller code, not a company service):

```ts
import { createApiClient } from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/api/environment";
import type { components } from "@/lib/api/generated/schema";

type Company = components["schemas"]["CompanyListResponseDto"];

function isCompany(value: unknown): value is Company {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "string"
    && "name" in value && typeof value.name === "string"
    && "document" in value && typeof value.document === "string"
    && "createdAt" in value && typeof value.createdAt === "string"
    && "updatedAt" in value && typeof value.updatedAt === "string";
}

function decodeCompanies(value: unknown): Company[] {
  if (!Array.isArray(value) || !value.every(isCompany)) {
    throw new Error("Invalid company list");
  }
  return value;
}

const api = createApiClient({ baseUrl: getApiBaseUrl() });
// accessToken and signal are supplied by the caller; no session storage is read.
const companies = await api.request("GET", "/companies", {
  token: accessToken,
  signal,
  decode: decodeCompanies,
});
// companies: Company[] | undefined
```

A DELETE can carry its documented JSON body:

```ts
await api.request("DELETE", "/products/{productId}", {
  pathParams: { productId },
  body: { companyId },
  token: accessToken,
});
// Result is unknown: this response schema defines only an example.
```

### Authorization forwarding boundary

The caller obtains a token from an explicitly approved source in a future session task and passes it as `token` per request. The client sends `Authorization: Bearer <token>` when provided. It never stores or shares that token across requests, reads browser storage, forwards incoming request headers/cookies implicitly, or decides whether a user can access a company.

The backend remains responsible for authentication, company membership and permissions. A missing token is sent as an unauthenticated request and can yield HTTP 401; the transport does not infer authorization from IDs. Tests use synthetic tokens only.

Requests use `credentials: "omit"`, `cache: "no-store"` and `redirect: "error"`: no implicit cookie authentication, cached identity-scoped data or automatic redirect following. Redirect rejection is a Fetch transport failure; its HTTP status is not exposed by native Fetch. There are no automatic retries, logout actions, navigation changes or refresh flows. F03 must explicitly revisit credentials/forwarding if a cookie-backed design is approved.

### Error contract

Catch `ApiError` independently of UI components:

| kind | Meaning | status |
|---|---|---|
| http | Non-2xx response; explicit safe messages for 400/401/403/404/409/500, fallback for other statuses | Original HTTP status |
| network | Fetch failure or interrupted successful response stream | Absent before response, present after headers |
| aborted | Cancellation before/during fetch or while reading the response | Present if response headers were received |
| invalid-response | Malformed JSON or rejected response decoder | Original success status |
| configuration | Missing or invalid base URL | Absent |
| request | Invalid URL parameters, headers or JSON serialization | Absent |

`message` is a fixed pt-BR message suitable for future UI display. HTTP `details` preserves an untrusted JSON value or raw text for controlled diagnostic handling; it is never used as the display message and is not logged automatically. No backend error envelope or field-error structure is assumed because the contract does not define one. Do not render `details` or raw technical exceptions to users.

### Verification

- `npm test`: focused Vitest tests with injected/spied Fetch and native Request/Response/AbortController primitives; no production API calls or extra mocking library.
- `npx tsc --noEmit --incremental false`: also checks decoder result types, DTO required/optional/nullability preservation, and negative compile-time request examples. Vitest runtime execution alone does not type-check these examples.
- `npm run api:check`, `npm run lint`, `npm run build`: generated contract drift, lint and production compilation.
