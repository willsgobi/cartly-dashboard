# Authentication module

## Routes (proposed)
`/login`, `/register`, `/activate-account`, `/forgot-password`, `/reset-password`. Confirm routing against existing app before creation.

## Contract
See `authentication.md`. Register requires name, email, password. Login requires email/password and returns `accessToken`, `user`. Activation and reset OTP must match `^\d{8}$`; resend and forgot password accept email only.

## UX / acceptance
Accessible forms with React Hook Form+Zod; field-level errors, pending states and generic account-discovery-safe messages where server specifies generic response. Successful login begins company-context flow. Do not invent /me, refresh-token, role claims or automatic activation behavior. Test 400/401/409 scenarios as documented. Session design is blocked until reviewed.
