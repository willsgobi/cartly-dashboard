# F03 session management

## Decision and boundaries

The user explicitly authorized a Next.js BFF with a server-managed HttpOnly cookie and confirmed no refresh tokens. Browser requests go to the same-origin Next.js application; server-only code calls the configured private API_BASE_URL through F02. No JWT is passed to Client Components, HTML/RSC payloads or JSON response bodies. No token/credential is logged or persisted in browser storage. No JWT signing secret is needed by this application: NestJS checks authenticity on protected operations.

The production cookie is `__Host-cartly_session` (`cartly_session` in development): HttpOnly, Secure in production, SameSite=Lax, Path=/, no Domain. Host-only scope covers dashboard and BFF endpoints. Expires/Max-Age are bounded by numeric JWT exp, rounded down; reads do not renew the cookie. Invalid, expired, unsigned alg=none, oversized (>3800 characters), or missing-exp tokens are rejected rather than receiving an invented lifetime. This is a fail-closed frontend cookie policy, not an OpenAPI correction. Supporting a backend token without exp requires an explicit lifetime contract.

Decoding exp only permits early rejection; it never verifies signatures or grants access. Before rendering protected content, requireDashboardAccess calls the documented bearer-protected GET /companies and validates its response. F06 now retains the decoded list in the authenticated server result for company selection, avoiding a duplicate request. The local session JSON endpoint still exposes no company data. This adds one backend read per protected render; no introspection service, role or permission is invented. 403 yields an access-denied state without logout; other upstream failures withhold content without destroying the session.

F08 uses getDashboardContext with React request-scoped memoization to share that guard/list result between layout and page. It does not persist authorization across requests and does not replace page/data checks. The layout receives only safe display fields and verified company DTOs; JWTs remain server-only.

The existing login BFF now also stores the validated SafeUserResponseDto name/email as a display-only snapshot in __Host-cartly_user (cartly_user outside production). This cookie is host-only, HttpOnly, Secure in production, SameSite=Lax, Path=/ and expires with the JWT. The encoded snapshot is integrity-bound to the current JWT using HMAC-SHA256 with a dedicated display-data prefix; no signing secret/environment setting or backend endpoint is added. It never proves authentication or permissions. Altered, malformed, oversized or foreign-session snapshots yield a generic account/welcome display; pre-F08 sessions remain valid without one. The profile is a login-time snapshot, not an invented current-user service. Logout/401 clear it along with the existing cookies, and replacing a session without display data clears any prior snapshot. Neither the JWT nor the HMAC cookie value is sent to Client Component props or HTML.

## Local endpoint contracts

These routes belong to Next.js, not NestJS:

| Endpoint | Request | Response |
|---|---|---|
| POST /api/auth/login | Same-origin JSON `{ email, password, returnTo? }` | 200 `{ user, returnTo }` and cookie; safe normalized error otherwise |
| POST /api/auth/logout | Same-origin POST; no body required | Cookie deletion and 303 to /login; no upstream logout |
| GET /api/auth/session | Cookie only; optional returnTo for error navigation | 200 `{ authenticated: true }`; 401 clears cookie and includes safe redirectTo; other errors preserve status/session |
| POST /api/companies/active | Same-origin form `{ companyId }` | Revalidated membership; session-bound preference cookie and 303 to dashboard; safe form-error redirect otherwise |

Login reads at most 16 KiB from the request stream and validates incoming fields with Zod. Passwords are not trimmed or given registration constraints. F02 calls POST /auth/login; Zod validates all LoginResponseDto/SafeUserResponseDto fields and strips unknown fields. Only the safe user DTO and a validated return destination are serialized. Invalid credentials receive HTTP 401 and `E-mail ou senha inválidos.` A successful upstream response with an unusable JWT produces 502 and no cookie. Error diagnostics and validation inputs are never returned to users.

authenticatedRequest is a server-only typed wrapper around F02: it checks local token usability, then forwards Bearer to a server-selected, contract-typed operation at API_BASE_URL. There is no public catch-all proxy and no client-controlled backend URL/path. F02 retains serialization, AbortSignal, no-store, redirect rejection and normalized errors. Future authenticated Route Handlers must apply assertSameOrigin before mutations and use authenticatedErrorResponse when catching errors. This response adapter clears only 401, preserves HTTP status and includes a safe login destination. 403 never clears cookies or initiates login.

For authenticated JSON fetch consumers, handle 401 by navigating to the returned redirectTo after receiving the response; do not retry or navigate for 403. JSON responses retain HTTP 401 rather than returning redirect HTML. F05's login adapter uses the existing login BFF (a login 401 means invalid credentials), validates the server-sanitized destination and navigates the whole document after success. It never receives a JWT. No general browser protected-data consumer is introduced.

## Protected rendering and invalidation

Next.js 16 proxy.ts matches /dashboard/:path* and /login. Missing cookies redirect to login; locally invalid/expired cookies are removed on the redirect. The normal dashboard check is optimistic; protected data/rendering must still check backend acceptance. /dashboard includes F06 company selection and /dashboard/onboarding now contains the F07 creation form. Future protected pages and data operations must use the server boundary themselves: a shared layout or Proxy alone is insufficient.

Server Components cannot mutate cookies. Their backend 401 redirects to /login?reason=expired with a safe return path; Proxy on that destination clears an invalid cookie. A still-live token is rechecked against the backend before removal so crafted URLs/stale redirects cannot log out a valid/new session. This bounded cleanup verification never retries login, renews tokens or replays mutations. 403/network/server failures during cleanup do not remove a valid-looking cookie. The login shell does not redirect back, preventing loops, and displays the pt-BR expiration message. If the browser already removed an expired cookie, the ordinary missing-session login path is used.

safeReturnTo allows only dashboard paths/query strings, rejecting external/protocol-relative URLs, backslashes, control characters and auth/API destinations; fallback is /dashboard. JWTs never appear in redirect URLs.

Cache Components remain enabled. Dynamic session reads use Suspense with a non-sensitive loading fallback. No protected data uses persistent use cache. Upstream authenticated requests, BFF responses, protected HTML and login/redirect responses are private/no-store. Intermediaries must honor those response headers.

The server rendering guard explicitly awaits connection() before reading the session or checking JWT expiry. With partial prefetching, cookies can already be available during runtime prerendering, which does not permit an unstable Date.now() read. This request-time boundary keeps expiry current and avoids the blocking-prerender-current-time error; session results and the clock are never cached. The existing Suspense boundary still provides the non-sensitive shell.

Local logout deletes the browser cookie; the underlying JWT remains valid at NestJS until expiration. No undocumented logout, current-user, refresh or permission endpoint is called.

F06 also clears the company preference on successful login, logout and session invalidation. The server binds the untrusted HttpOnly preference to the current session and checks it against the accessible company list on restoration. It never grants authorization. Full document switching discards prior company state; see [modules/companies.md](modules/companies.md).

## Configuration and security

Set server-side API_BASE_URL to the trusted backend and APP_ORIGIN to the exact public dashboard origin. Copy .env.example for local values; production hosting must supply actual values and HTTPS. APP_ORIGIN must contain no path, credentials, query or fragment. It controls redirects and CSRF independently of untrusted Host/X-Forwarded-Host headers. The production cookie is always Secure. No credential, JWT or signing secret belongs in these examples.

Next.js does not load .env.example automatically. Create .env.local at the project root before starting development. The example uses API_BASE_URL=http://localhost:3000 and APP_ORIGIN=http://localhost:3001; run npm run dev -- --port 3001. Match the dashboard's actual scheme, hostname and port exactly. Restart Next.js if environment edits have not been picked up. Missing APP_ORIGIN deliberately fails closed, including when Proxy builds an unauthenticated login redirect; do not work around this by trusting incoming Host headers or disabling Origin checks.

When a public Server Action fails before contacting NestJS, inspect its POST request in browser Network tools. Origin must equal APP_ORIGIN; Sec-Fetch-Site, when present, must be same-origin. The API or Swagger documentation URL is not the dashboard origin. Check these two headers only, without copying cookies, passwords or OTPs. A configured localhost origin does not authorize 127.0.0.1, a LAN address, another port or another scheme. If the browser origin matches the configured value, verify the Fetch metadata and restart Next.js to rule out an older environment value. Removing assertSameOrigin bypasses this check rather than fixing the mismatch; public recovery operations still require it.

All current state-changing endpoints require an exact Origin match. Missing/null/foreign origins and inconsistent Sec-Fetch-Site values receive 403 before upstream calls or cookie changes. Login also requires JSON; GET cannot invoke login/logout (405). Read-only session/login cleanup can remove only an already-invalid session after local expiration or backend 401, so visiting a crafted URL cannot destroy a valid session. Future mutation endpoints must use the same origin check. No permissive CORS policy is configured.

HttpOnly reduces XSS token theft but does not make same-origin script injection harmless: injected scripts could still initiate actions. Error messages are fixed pt-BR text; untrusted ApiError.details is not serialized. Upstream redirects are rejected instead of forwarding credentials to another destination.

## Verification

- npm test: login/validation, JWT policy, cookie attributes, CSRF, 401/403 mapping, safe returns, Proxy and server rendering guard tests; only synthetic tokens and mocked NestJS responses.
- npm run build, then npm run test:auth:production: starts/stops a real Next.js production server and a loopback-only mock API. Verifies actual routing, GET 405, cookie attributes, SSR access, forged/expired JWT rejection, no-store, no response token leakage, CSRF, 401 cleanup, 403 preservation and logout. No production API is contacted.
- npx tsc --noEmit --incremental false; npm run lint; npm run api:check.

F05 additionally provides npm run test:auth:browser, which runs the production HTTP assertions and then Chrome/Chromium through native DevTools Protocol, without an extra dependency. Set CHROME_PATH to the executable outside the default Windows Chrome location. It checks actual UI login, safe returns, HttpOnly/Secure cookies, refresh persistence, protected requests, backend 401 cleanup, 403 preservation, native logout and browser-history isolation after cookie deletion. All accounts/tokens are synthetic and the backend is isolated. Temporary browser profiles contain synthetic fixtures only.

F05 live local NestJS checks confirmed invalid credentials, unauthenticated access, forged future JWTs and expired synthetic JWTs return 401; the actual local BFF returned 401 for invalid credentials and 303 for unauthenticated dashboard access. No activated test-account credentials were provided: successful real-NestJS login/protected access/persistence/logout remain a manual integration check. Passing the isolated production/browser suite is not a claim of positive real-backend verification.

F07 adds same-origin POST /api/companies and POST /api/lookups/cnpj or /api/lookups/cep. They reuse authenticatedRequest/authoritative access checks and authenticatedErrorResponse, with private no-store responses. External providers never receive a JWT or cookies. The bounded JSON reader previously local to login is shared with creation, preserving the 16 KiB limit and validation behavior. See [modules/onboarding.md](modules/onboarding.md).

The implementation follows the official [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication), [Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) and [BFF guide](https://nextjs.org/docs/app/guides/backend-for-frontend). Actual deployment URLs and HTTPS are operator configuration; backend permission discovery remains unresolved. F05 supplies login, F06 company selection, F07 creation and F08 the responsive shell; business modules remain unimplemented.
