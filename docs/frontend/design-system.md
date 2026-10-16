# Cartly Dashboard — Design system

## Reference
Use the previously explored Cartly dashboard/login/onboarding layouts as **visual direction**, not as proof of implemented UI. Reference screenshots may be supplied separately. Responsive adaptation is required.

## Foundation
- Typography: Inter (400, 500, 600, 700); load using `next/font/google`, replacing the current starter Geist only in the foundation task.
- Colors: primary `#10B981`, primary-dark `#047857`, primary-light `#ECFDF5`, text `#0F172A`, secondary-text `#475569`, muted `#94A3B8`, background `#F8FAFC`, surface `#FFFFFF`, border `#E2E8F0`, danger `#EF4444`, warning `#F59E0B`, info `#3B82F6`.
- Suggested spacing scale (rem): 0.25, 0.5, 0.75, 1, 1.5, 2, 3. Suggested radii: 8px inputs, 12px cards, 16px dialogs. Treat as design choices, not existing implementations.
- SCSS Modules for components, global SCSS for resets and tokens; do not mix utility-framework styles by default. Current project contains Tailwind import: remove only during an explicit foundation migration, after inspection.

## UI primitives
Build reusable accessible `Input`, `PasswordInput`, `Button`, `Select`, `Textarea`, `Checkbox`, `FormField`, `Card`, `Dialog`, `Table`, `EmptyState`, `Skeleton`, `Toast` as needed. Use typed native props, `forwardRef` only if necessary for library compatibility, stable IDs, labels and error associations.
- Buttons: explicit type, disabled/loading semantics and visible focus.
- Forms: label, help text, inline errors, submit progress; never rely on color alone.
- Tables: responsive overflow, empty/loading/error states, sortable/filterable only when available.
- Layout: sidebar, company switcher, header, mobile navigation and content; typography hierarchy consistent across modules.
- Accessibility: keyboard, visible focus, semantic landmarks, contrast, ARIA only where needed, reduced-motion support.
