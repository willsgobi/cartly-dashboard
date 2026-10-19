import type { ReactNode } from "react";
import { RecoveryProvider } from "@/features/auth/RecoveryContext";

export default function RecoveryLayout({ children }: { children: ReactNode }) {
  return <RecoveryProvider>{children}</RecoveryProvider>;
}
