# Authentication and authorization

## Verified OpenAPI operations
- `POST /auth/register` → `RegisterDto` → 201 `SafeUserResponseDto`; user activation email sent.
- `POST /auth/login` → `LoginDto` → 200 `{ accessToken, user }` (`LoginResponseDto`).
- `POST /auth/activate-account` → `OtpDto` (`email`, eight-digit string `otp`) → 200.
- `POST /auth/resend-activation` → `EmailDto` → generic message.
- `POST /auth/forgot-password` → `EmailDto` → generic message.
- `POST /auth/reset-password` → `ResetPasswordDto` (`email`, eight-digit `otp`, `password`) → 200.
- Protected operations use OpenAPI `bearer` JWT security.

## Session design — F03 decision
The F03 request explicitly authorizes an HttpOnly-cookie BFF and confirms there are no refresh tokens. The implemented decision, endpoint contracts, expiration policy, CSRF controls and verification commands are documented in [session-management.md](session-management.md). NestJS remains the token-validity and authorization authority. No backend introspection/logout operation, browser token storage or refresh flow is invented. F05 adds the complete login UI using that existing boundary; company-context flow remains F06 work.

## Guards and errors
- Protect the dashboard server-side wherever feasible; handle 401 by invalidating the local session and prompting login, without loops.
- Do not automatically equate an inactive user to a specific status/error not documented; preserve server message safely.
- Authorization is company-scoped and permission-based, per `docs/backend-reference/authorization.md`. Hide/disable unauthorized actions for UX, but backend remains sole authority.
- `SafeUserResponseDto` does not expose a role/permission matrix; do not assume `user.role` exists. Confirm a reliable permission source before permission-sensitive rendering.
- After login: fetch `GET /companies`. If none, show company onboarding; otherwise active-company selection and authorized dashboard.
- Logout from the dashboard can clear its own local server cookie if that design is adopted; it does not imply remote JWT revocation.
