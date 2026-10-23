import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.scss";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Venduzily — Componentes",
  description: "Demonstração dos componentes de interface do Venduzily.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
