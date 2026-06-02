import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_NAME = "Harta Teren";

export const metadata: Metadata = {
  title: "Harta Teren - Puncte de Foraj",
  description: "Aplicație pentru managementul punctelor de foraj pe teren - funcționează offline",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { statusBarStyle: "default", title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#1e293b",
};

import OfflineIndicator from "@/components/OfflineIndicator";
import OfflineSyncEffect from "@/components/OfflineSyncEffect";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 safe-area-top safe-area-bottom safe-area-left safe-area-right">
        <OfflineIndicator />
        <OfflineSyncEffect />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
