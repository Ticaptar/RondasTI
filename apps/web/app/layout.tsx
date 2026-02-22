import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "RondaFlow",
  description: "Checklist de ronda TI auditado com fotos, horário e localização",
  applicationName: "RondaFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RondaFlow"
  }
};

export const viewport: Viewport = {
  themeColor: "#0b1020"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
