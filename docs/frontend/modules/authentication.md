# Authentication module

## Routes (proposed)
`/login`, `/register`, `/activate-account`, `/forgot-password`, `/reset-password`. Confirm routing against existing app before creation.

F04 implements /register and /activate-account. F05 adds the functional /login form to F03's status shell, retaining expiration and activation-success messaging. Password recovery routes are not implemented.

## Contract
See `authentication.md`. Register requires name, email, password. Login requires email/password and returns `accessToken`, `user`. Activation and reset OTP must match `^\d{8}$`; resend and forgot password accept email only.

## UX / acceptance
Accessible forms with React Hook Form+Zod; field-level errors, pending states and generic account-discovery-safe messages where server specifies generic response. Successful login begins company-context flow in its future task. Do not invent /me, refresh-token, role claims or automatic activation behavior. Test 400/401/409 scenarios as documented. F03 implements the approved HttpOnly-cookie BFF, local logout and protected route foundation described in session-management.md. F05 completes the login form and verifies that foundation; company-context flow remains F06 work.

## F05 login and local logout

- LoginForm uses the existing email/required-password validation, Input, PasswordInput, Button and authentication SCSS. It supports keyboard submission, visible field errors, password visibility, busy/disabled states and an in-flight submission guard. No password complexity rule is added.
- The Server Component restricts returnTo with F03's safeReturnTo. features/auth/login.ts sends JSON credentials and that destination to the existing /api/auth/login with same-origin credentials, no-store and redirect rejection. Only F03 calls NestJS POST /auth/login and sets the HttpOnly cookie. The browser adapter ignores user/diagnostic properties, validates the returned destination against the server-sanitized value and performs a full document navigation, avoiding stale router data across sign-in.
- HTTP 401 produces the invalid-credentials message; other errors use F02's safe messages. Unexpected technical errors are not displayed. Successful navigation clears form values. Registration and activation links remain public.
- The dashboard's existing native POST Sair action clears only the local cookie and redirects to login. It is not backend JWT revocation. Existing per-render authoritative guards, no-store policies, 401 cleanup and 403 preservation are reused without changes. No company routing, refresh flow or new BFF endpoint is added.

## F04 registration and activation

- Client forms use React Hook Form + the Zod resolver, native POST form semantics, existing Input/Button and a reusable PasswordInput visibility control. Inline labels/errors, focus on invalid fields, live status messages, busy/disabled controls and a shared in-flight guard prevent duplicate or concurrent activation/resend submissions. No client cooldown is invented.
- Shared schemas validate a nonblank name, email, a required password and matching confirmation. The supplied backend documentation/OpenAPI has no password length/complexity constraints; none are added. Passwords are not trimmed. Server Actions independently validate untrusted input and strip extra fields, including confirmPassword, before sending the exact DTO through F02.
- registerAccount calls POST /auth/register, handles 201/400/409 and validates SafeUserResponseDto. On success the form clears passwords and navigates to /activate-account?registered=1. Email is re-entered there, so no email, password or OTP is placed in the URL or browser storage.
- activateAccount sends email and OTP to POST /auth/activate-account. OTP is a text field with numeric input mode and exactly eight ASCII digits, preserving leading zeros and accepting a full paste. 400 covers invalid/expired/used/exhausted codes. Success clears form data and navigates to /login?status=activated, which displays a pt-BR success message.
- resendActivation calls POST /auth/resend-activation with email only. The client always uses generic confirmation wording and ignores the upstream message. Missing/invalid email is rejected before sending; no OTP is required to resend.
- Actions enforce APP_ORIGIN through F03's assertSameOrigin in addition to Next.js Server Action origin protection. Request destinations are fixed backend paths at API_BASE_URL; no arbitrary URLs, cookies, JWT forwarding, automatic login, retries, logging of form data or raw backend diagnostics are introduced.
- UI tests mock actions; server tests mock Fetch and verify DTOs, errors and no cookie access. Browser validation against an isolated mock API exercises the actual production Server Action transport and login/register/activation navigation. Live API negative-path checks do not establish successful real-mailbox activation.
