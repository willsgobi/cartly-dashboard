# Company onboarding

## Flow
After authenticated `GET /companies`, if no accessible company is returned, offer create-company onboarding. If one or more, route to active-company selection/dashboard. Do not assume a server-side role in user profile.

F06 prepares /dashboard/onboarding as a protected empty-state destination with retry and logout. It does not implement the F07 creation form or POST /companies. A verified nonempty list redirects from that boundary back to /dashboard. See [companies.md](companies.md) for selection and isolation behavior.

## Create contract
`POST /companies`: `{ name: string, document: string, address: { street, city, number, state, zipCode, country } }`; all six address fields required. Response `CompanyResponseDto` includes the created address and company ID. Error states: 400 validation, 401 unauthorized, 409 duplicate document, 500 ADMIN configuration error. Show clear actionable feedback without internal details.

## Edit contracts
`PATCH /companies/{companyId}` accepts optional name/document; `PATCH /companies/{companyId}/address/{addressId}` supports fields in `UpdateCompanyAddressDto` only. Do not assume update-address number is supported. Company selection must never leak another company's resources.
