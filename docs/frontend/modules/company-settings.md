# F17 company settings and existing addresses

## Scope and route

The user explicitly assigned this feature to F17. References to F14 in the supplied task body are a numbering discrepancy: F14 remains the separately planned metrics/remaining-modules task. F16 remains deleted-product listing/restoration, blocked on its API contracts.

Configurações links to /dashboard/settings/company, following the existing protected dashboard route structure. The server workspace reuses getDashboardContext and its authoritative GET /companies, redirecting zero companies to onboarding and missing multi-company selections to /select-company. No second company provider or session design is introduced.

## API boundary

- GET /companies/{companyId} returns CompanyDetailsResponseDto and the actual addresses array, including an empty array or multiple addresses.
- PATCH /companies/{companyId} sends only a changed name and returns CompanyDetailsResponseDto. Following the user's immutability requirement, the dashboard narrows UpdateCompanyDto to name only and rejects document at its BFF boundary, while preserving the raw backend contract.
- PATCH /companies/{companyId}/address/{addressId} sends only changed street/city/state/zipCode/country fields from UpdateCompanyAddressDto and returns CompanyDetailAddressResponseDto.

Fixed same-origin BFF routes under /api/companies/[companyId] independently verify the session and active selection against a fresh accessible list. Their companyId query is a local stale-scope check, not an invented NestJS query parameter. The path must match the verified active company. Address mutations fetch fresh parent details and verify membership before forwarding both path IDs. Unknown fields, empty mutations and client-supplied number/company IDs are rejected. Responses are decoded from unknown, checked for company/address identity and duplicate address IDs, and stripped to documented properties. All requests/responses are no-store; JWTs stay on the server. CSRF, bounded JSON, 401 cleanup and 403 preservation reuse F02/F03/F06.

## Forms and validation

CompanyInformationForm uses RHF/Zod and existing Input/Button. CNPJ is displayed with the Brazilian mask (00.000.000/0000-00) in a read-only, unregistered field; formatting is presentation-only and preserves the original API value. The same formatting is shared by company selection cards and the dashboard switcher. It does not affect form validation or PATCH payloads. Only the company name is editable. Direct document-only or combined name/document requests to the BFF are rejected before a company PATCH. There is no automatic ReceitaWS lookup or company-name replacement. Backend authorization and validation remain authoritative; no role/permission endpoint is inferred.

Addresses render as returned records, with a specific edit action for each ID. CompanyAddressForm reuses Modal, Input/Button and existing address conventions. Required text and normalized eight-digit CEP validation follow the inspected update DTO/F07 policy. Inputs are prefilled, failures preserve values, pending mutations block duplicates/dismissal and unchanged saves are disabled. Cancel restores company information or dismisses address editing. Modal focus returns to the selected address control after refresh.

The supplied OpenAPI and inspected UpdateCompanyAddressDto still omit number, even though create/detail DTOs include it. Number is read-only and never submitted. No address create/delete, company delete, product images or unrelated module is added.

## ViaCEP and stale work

Address editing calls F07's existing lookupCompanyData("cep") and the same authenticated /api/lookups/cep handler, including its provider validation, timeout and throttle. The transport accepts a settings-specific safe login return while retaining the onboarding default. There is no duplicate provider service.

Lookup is explicit. Returned nonempty street/city/state values populate editable fields; number and country are preserved. Per-field edit versions protect newer manual changes. ZIP edits cancel outstanding work and advance a generation; source checks, AbortSignal and unmount cleanup ignore obsolete responses. Failed lookup permits manual submission. Mutations cancel lookup work first.

## Synchronization and isolation

The existing F06 provider keys scope by active company ID. Settings also key their local boundary by that ID, abort detail/mutation/lookup requests on teardown and ignore late responses. Header switching retains the native full-document reset convention: unsaved forms are discarded rather than carried into another company.

Successful mutations announce completion and refetch details. Company information updates also call router.refresh(), refreshing the authoritative F06 company list/header without changing active company ID or replacing the company context. Company form resets depend on the company name, so an address-only refresh preserves unrelated unsaved company edits. The selected address modal closes after commit; the remaining page stays in place. Failed post-commit refresh locks stale management and offers GET-only retry, never replaying PATCH.

## Verification and live limitations

Fetch/action component mocks cover exact partial DTOs, unchanged saves, document conflicts, 404/401/403, malformed/cross-company responses, multiple/empty addresses, correct address ID, read-only number, duplicate/pending locks, error preservation, manual ViaCEP fallback, edit races, company teardown, late responses, header refresh request and GET-only recovery. The production Chrome suite uses isolated mock NestJS to exercise actual BFF operations and layout refresh; it does not contact public providers or require live credentials.

Positive live authenticated updates require an authorized test account. Only unauthenticated endpoint behavior may be claimed when credentials are unavailable. Existing monetary/product API questions and the missing permission-discovery contract are not resolved by F17; unsupported address number editing remains an explicit limitation.
