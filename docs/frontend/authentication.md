# Authentication and authorization

## Verified OpenAPI operations
- `POST /auth/register` → `RegisterDto` → 201 `SafeUserResponseDto`; user activation email sent.
- `POST /auth/login` → `LoginDto` → 200 `{ accessToken, user }` (`LoginResponseDto`).
- `POST /auth/activate-account` → `OtpDto` (`email`, eight-digit string `otp`) → 200.
- `POST /auth/resend-activation` → `EmailDto` → generic message.
- `POST /auth/forgot-password` → `EmailDto` → generic message.
- `POST /auth/reset-password` → `ResetPasswordDto` (`email`, eight-digit `otp`, `password`) → 200.
- Protected operations use OpenAPI `bearer` JWT security.

## Session design — decision required before coding
The API returns an `accessToken` in JSON; OpenAPI does **not** specify refresh, logout, current-user/session introspection, or cookie endpoints. Do NOT invent them or claim persistent refresh sessions. Preferred architecture to assess: browser posts credentials to a Next.js server-side route handler, which calls the API and stores the access token in a `Secure`, `HttpOnly`, `SameSite` cookie, with server-to-API forwarding and CSRF protections where relevant. This is a frontend architecture option, NOT confirmed existing API behavior. Review deployment topology, CORS, caching, cookie domain, HTTPS and CSRF before implementing. Avoid `localStorage` for long-lived tokens. If purely client-side bearer-token design is chosen, explicitly document XSS and reload/session tradeoffs.

## Guards and errors
- Protect the dashboard server-side wherever feasible; handle 401 by invalidating the local session and prompting login, without loops.
- Do not automatically equate an inactive user to a specific status/error not documented; preserve server message safely.
- Authorization is company-scoped and permission-based, per `docs/backend-reference/authorization.md`. Hide/disable unauthorized actions for UX, but backend remains sole authority.
- `SafeUserResponseDto` does not expose a role/permission matrix; do not assume `user.role` exists. Confirm a reliable permission source before permission-sensitive rendering.
- After login: fetch `GET /companies`. If none, show company onboarding; otherwise active-company selection and authorized dashboard.
- Logout from the dashboard can clear its own local server cookie if that design is adopted; it does not imply remote JWT revocation.
