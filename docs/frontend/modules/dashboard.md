# Dashboard home

## Design goal
Use the Cartly visual identity for the administrative shell: sidebar, company selector, account controls, white surfaces and responsive mobile navigation. Metrics, charts and activities remain future modules with verified API contracts.

## Contract boundary
Provided Swagger does not include analytics, orders, revenue, recent activity or dashboard metrics endpoints. Do not invent data sources, financial values or fake live KPIs. A visual-only scaffold with clearly labeled demo data requires an explicit task; otherwise show clearly defined placeholders or focus first on shell/navigation and supported counts derived from available categories/products, with no claims of financial meaning.

## F08 App Router shell

app/(dashboard)/layout.tsx composes the server DashboardLayout under Suspense. Modular components in components/layout provide Sidebar, SidebarNavigation, DashboardHeader, MobileNavigation, UserMenu, code-native decorative icons and SCSS Modules. The existing Cartly logo, Inter and centralized color/spacing/radius/shadow tokens are reused. Pages remain Server Components; only navigation/pathname, drawer, account disclosure and the existing company selector require client behavior.

features/companies/server-context.ts memoizes one authoritative guard/list result with React cache within the current server request. Layout and page both use it: there is no second company context, duplicate backend list call or persistent session/data cache. The production test explicitly checks one GET /companies per dashboard render. The original connection() boundary, backend 401/403 handling and per-page/data authorization requirements remain in place. Denied/unavailable access withholds shell company/profile data and renders the existing safe page state; missing/expired sessions redirect through F03.

## Navigation and responsive behavior

Desktop uses a 224px sidebar and a flexible content column. Below 64rem the sidebar is hidden and the header exposes a modal navigation drawer with the same Sidebar component. Header actions wrap/adapt for tablet/mobile widths; content and long names use constrained flexible columns and wrapping, without horizontal scrolling at 320/390/768/1280px.

The navigation lists Dashboard, Pedidos, Produtos, Categorias, Clientes, Usuários, Relatórios and Configurações. Dashboard, F09 Categories and F10 Products have real links; each exact route receives aria-current=page after hydration. All unavailable modules are noninteractive aria-disabled text with Em breve, not links to nonexistent pages. No role/permission rule, analytics data or backend operation is invented.

The protected landing page greets the user using the available login display snapshot and shows the verified active company. Multi-company sessions without a verified selection redirect to /select-company before the dashboard shell or company-specific managers render. A clearly worded empty workspace replaces metrics. Criar nova empresa continues to reuse F07. These company creation/back/retry entry points use document navigation so both page and App Router layout refresh their verified company context; layout reuse alone must not leave an old header after list changes.

## Company and account integration

The shared header title and active navigation use useHydratedPathname. Its useSyncExternalStore server snapshot renders the same neutral title (Painel administrativo) and no active link during SSR and initial hydration, even when Next's server pathname differs from the browser route. After hydration, usePathname supplies the current title/aria-current and continues updating during client navigation. This avoids text/attribute mismatches without suppressHydrationWarning or changing authorization/cache boundaries. The mobile drawer still observes pathname only in an effect for closing on navigation.

DashboardHeader reuses F06 CompanySelector in a compact presentation; no selection or persistence logic is duplicated. A single company is automatic, multiple companies use the existing native POST /api/companies/active, and zero companies show a neutral header while the page redirects to onboarding. That POST still revalidates membership, sets the existing session-bound preference and reloads the document, discarding prior company state. ActiveCompanyProvider wraps the shell/page slot and keys its subtree by selected company ID.

Selecting a different company immediately submits that same validated POST; there is no confirmation button. The pending state disables selection and prevents duplicate submissions. Selecting the current company does nothing. A separator below the sidebar navigation introduces Minha conta, which reuses the existing account disclosure and local logout exclusively in desktop and mobile sidebars. The header contains only company selection alongside its heading/mobile navigation trigger. The account disclosure uses a centered decorative SVG chevron instead of a font glyph.

F03 login already returns SafeUserResponseDto but previously retained only the JWT. F08 preserves just name/email in a separate HttpOnly host-only display cookie, Secure in production and bounded by the same JWT expiration. Its HMAC uses the current server-only JWT as key and a dedicated display-data domain, so altered/foreign-session snapshots are ignored without introducing an environment secret. This does not verify JWT authenticity, authenticate a user or grant permissions. Rendering still requires the backend-authoritative guard. Tokens/signatures are never passed as layout props or rendered in HTML. See [../session-management.md](../session-management.md).

Sessions created before F08 keep working with generic Boas-vindas/Minha conta text; the next successful login populates the display snapshot. Profile changes after login are not synchronized because no current-user endpoint is documented. The account disclosure exposes name/email and the existing native POST logout. Logout/401 delete the JWT, company preference and display cookie. No refresh flow, permission claims or /me endpoint is added.

## Accessibility

- Sidebar/navigation, header and main landmarks, a skip-to-content link and a real heading hierarchy are provided; SVG icons are decorative and labels remain textual.
- Native dialog.showModal supplies modal focus containment and inert background semantics. Close button, Escape/cancel, backdrop selection, real navigation and desktop resize close the drawer. Body scrolling is locked while open and restored on cleanup. The close event restores the mobile trigger focus; desktop resize targets main content instead of a hidden trigger.
- Mobile and desktop reuse one Sidebar implementation. Unavailable items have no interaction or keyboard stop. Links/buttons/selects retain visible focus and minimum touch targets.
- The account control uses a native details/summary disclosure, not an incomplete ARIA application menu. Its controls follow normal Tab navigation and Escape closes it/restores summary focus. No clickable div substitutes for a control.

The native dialog behavior follows [MDN showModal](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) and [WAI technique H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102). jsdom tests provide minimal dialog method stubs; real focus/inert/Escape/overlay behavior is independently verified in Chrome.

## Verification and limits

Unit/component tests cover shell composition, current/unavailable navigation, single/multiple company header presentation, drawer controls/cancel/focus restoration, account disclosure/logout and display snapshot integrity/isolation/cleanup. Existing F03/F06/F07 tests retain their own auth/selection/onboarding coverage. The production Chrome suite checks safe welcome after refresh, JWT/profile HttpOnly behavior, switching, native drawer inert background and keyboard operation, close/focus restore, overlay/navigation closure, logout, all responsive widths and screenshots. Desktop/mobile/drawer screenshots are visually inspected.

No activated real NestJS account was supplied; positive backend integration remains a manual check. The mock-backed tests do not claim live deployment validation. F09/F10 add Categories/Products routes using this shell; metrics, new dependencies and backend/OpenAPI changes remain outside this implementation.
