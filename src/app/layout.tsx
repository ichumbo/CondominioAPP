import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portaria+ | Agenda e gestão condominial",
  description:
    "Plataforma minimalista para agenda de espaços, atendimentos, portaria, visitantes, encomendas, ocorrências e administração condominial.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  applicationName: "Portaria+",
  appleWebApp: { capable: true, title: "Portaria+", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#90B800",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
