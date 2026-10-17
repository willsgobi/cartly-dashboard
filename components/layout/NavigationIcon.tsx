export type IconName = "dashboard" | "orders" | "products" | "categories" | "customers" | "users" | "reports" | "settings" | "menu" | "close" | "chevronDown";
const paths: Record<IconName, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  orders: "M5 4h14v17l-3-2-4 2-4-2-3 2z M9 8h6 M9 12h6",
  products: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7 5l10 4",
  categories: "M3 4h8l10 10-7 7L3 10z M7 7h.01",
  customers: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 6 0 0 1 16 0v2",
  users: "M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M2 20v-2a7 5 0 0 1 14 0v2 M17 4a3 3 0 0 1 0 6 M19 14a5 5 0 0 1 3 4v2",
  reports: "M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8",
  settings: "M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  close: "M6 6l12 12 M6 18L18 6",
  chevronDown: "M6 9l6 6 6-6",
};

export function NavigationIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
