# Company onboarding

## Flow
After authenticated `GET /companies`, if no accessible company is returned, offer create-company onboarding. If one or more, route to active-company selection/dashboard. Do not assume a server-side role in user profile.

F06 prepared /dashboard/onboarding as a protected navigation boundary. F07 renders the two-step creation form there, retaining retry/logout and the authoritative guard. The dashboard's Criar nova empresa link opens the same form even when the user already has companies. Voltar ao dashboard cancels navigation without changing the current selection; successful creation verifies and activates the new company through the existing F06 flow. See [companies.md](companies.md) for selection and isolation behavior.

## Create contract
`POST /companies`: `{ name: string, document: string, address: { street, city, number, state, zipCode, country } }`; all six address fields required. Response `CompanyResponseDto` includes the created address and company ID. Error states: 400 validation, 401 unauthorized, 409 duplicate document, 500 ADMIN configuration error. Show clear actionable feedback without internal details.

## Edit contracts
`PATCH /companies/{companyId}` accepts optional name/document; `PATCH /companies/{companyId}/address/{addressId}` supports fields in `UpdateCompanyAddressDto` only. Do not assume update-address number is supported. Company selection must never leak another company's resources.

## F07 form and validation

CompanyOnboardingForm in features/companies/onboarding uses React Hook Form/Zod with existing Input/Button and Cartly SCSS tokens. Step one collects document (numeric CNPJ) and legal name; step two collects the six exact CreateCompanyAddressDto fields. All inputs, including autofilled values and country, remain editable. Hidden mounted fieldsets preserve values across step navigation; focus moves to the current step. Each lookup and final submission has independent feedback/loading. Native POST semantics prevent unhydrated GET submissions from putting form values in URLs.

Formatted CNPJ is normalized to 14 digits and both check digits are verified, rejecting repeated digits. The numeric-only scope follows the explicit F07 request; alphanumeric CNPJ is not supported in this task. CEP accepts digits, spaces, dots and hyphens (including ReceitaWS-style 01.001-000) and is normalized to an eight-digit string, preserving leading zeros; letters and invalid digit counts are rejected. Name/address strings are required without inventing extra backend constraints. Successful lookups are optional for submission. Unknown DTO properties are stripped, and no neighborhood, complement, phone or external metadata is sent to Cartly.

## External lookup boundary

- POST /api/lookups/cnpj?value=... and POST /api/lookups/cep?value=... are local same-origin BFF operations, not NestJS endpoints. The local POST method enforces the existing exact-Origin CSRF check and avoids quota consumption from cross-site navigations. Parameters are validated before any provider request. A usable cookie and authoritative GET /companies check are required; a forged future-exp token cannot consume public lookup quota.
- The upstream URLs are fixed: GET https://receitaws.com.br/v1/cnpj/{14 digits} and GET https://viacep.com.br/ws/{8 digits}/json/. Upstream calls have an eight-second timeout, request cancellation, no-store, redirect rejection and omitted credentials. Neither JWT nor browser cookies are forwarded. Only supported mapped fields are returned; raw diagnostics and external payloads are not logged or persisted.
- ReceitaWS requires status OK and a nonblank nome. Supported address strings are mapped when supplied, with country Brazil and normalized CEP when valid. Missing company identity, error status, malformed responses, HTTP failures, 429, timeout and transport failure yield safe pt-BR fallback messages.
- ViaCEP success requires a matching normalized CEP and usable city/state fields, in addition to checking erro: true (including the string representation). HTTP 200 alone is insufficient. Street may be empty for general postal codes; manual completion remains available. CEP lookup never changes number, company name or country.

The [ReceitaWS public documentation](https://developers.receitaws.com.br/) specifies up to three requests per minute. A process-wide sliding window admits at most three CNPJ requests per rolling minute across all sessions. Rejected/thrown provider requests still consume quota; there are no retries. A separate application throttle admits 20 CEP requests per minute (not a claimed ViaCEP quota). Local throttling returns 429 with Retry-After. [ViaCEP documentation](https://viacep.com.br/) describes the eight-digit format, nonexistent-CEP error and mass-use restrictions.

The limiters retain only timestamps and are in memory per server process. Multi-instance/serverless deployments or several applications sharing one egress IP require a shared quota gateway/rate limiter before production traffic; process-local counters cannot guarantee a global provider limit or survive restarts. No distributed storage dependency or external credentials are introduced by F07. Provider 429 is handled safely and does not block manual creation.

## Lookup lifecycle and manual fallback

CNPJ lookup runs only on the explicit Consultar CNPJ action. CEP lookup runs on confirmation/blur of a valid CEP or its explicit action, with duplicate pending/blur requests suppressed. A complete CNPJ-provided address marks its CEP as already resolved, avoiding an automatic ViaCEP request. Editing the CEP permits a new lookup; an explicit action can retry a previously failed query.

The hook tracks request generations, AbortControllers and per-field edit versions. Responses from replaced/canceled queries are ignored. A response cannot overwrite a field edited after its request started, even if the user changed it back to the prior value. The latest address request wins between CNPJ and CEP lookups; changing CEP invalidates pending CNPJ address data. setValue marks only applied values dirty and revalidates them. Final submission cancels pending lookups, and unmount cancels outstanding work. No request automatically submits the company.

Every failure leaves fields editable. Independent live feedback describes CNPJ/CEP queries, success, quota or manual fallback. Backend validation remains authoritative; external data is a convenience and never proof of company ownership, address validity or user permission.

## Creation and active company synchronization

POST /api/companies is an authenticated same-origin JSON BFF boundary. It reuses F02/F03 authenticatedRequest and the existing bounded JSON reader (now shared with login), revalidates/normalizes the exact DTO and calls NestJS POST /companies once. It handles 400/401/403/409/500 through safe status mapping; 401 clears session/preference cookies, 403 preserves them, and duplicate document receives a specific friendly message. Error diagnostics are never exposed. The form preserves inputs on failures and guards duplicate submission; no mutation retry or undocumented idempotency contract is added.

After a valid 201 CompanyResponseDto, the handler refreshes GET /companies and verifies the returned ID is accessible before setting F06's existing session-bound company preference. A full document navigation to /dashboard discards prior company/router state; subsequent rendering verifies the list again through F06.

If creation commits but synchronization fails or the created ID is absent, the response explicitly reports created: true, active: false. The form disables further creation and offers only Verificar acesso e continuar, using F06's existing POST /api/companies/active to recheck access and select the ID. A synchronization 401 clears the session. This avoids accidentally replaying a committed creation. If the initial POST transport fails, its commit status is inherently unknown because the backend supplies no idempotency endpoint; the frontend does not retry automatically.

## Verification and remaining integration limits

Automated tests mock all external HTTP calls. Coverage includes numeric CNPJ/check digits, normalized DTOs, protected lookups, fixed URLs/no credential forwarding, provider status/errors/timeouts/429, the sliding window, ViaCEP erro/malformed/mismatched responses, manual fallback, independent loading, field edit preservation, stale query cancellation, step retention, 409, single creation, verified activation, synchronization-only recovery and full dashboard navigation.

The production Chrome suite intercepts local lookup responses to simulate provider unavailability without contacting public APIs. It verifies the actual two-step UI, manual fallback, value retention, responsive widths, exact normalized POST through the real Next.js BFF to a loopback mock NestJS, active-company cookie synchronization, dashboard redirect and refresh. Server Route Handler behavior and successful provider mappings are independently covered by mocked Fetch tests. A mobile screenshot is visually inspected.

No activated real-backend test account was supplied, so successful live NestJS creation and live third-party lookups are not claimed. Production must configure API_BASE_URL, APP_ORIGIN, HTTPS and shared provider throttling where multiple processes share quota. No backend/OpenAPI changes or F08 shell/features are included.
