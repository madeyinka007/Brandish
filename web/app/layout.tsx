import type { Metadata } from "next";
import { IBM_Plex_Serif, Inter } from "next/font/google";
import "./globals.css";

// Inter powers the admin dashboard; IBM Plex Serif is the public site's headline face
// (see the Smart Times design system). Both are exposed as CSS variables — nothing forces a
// global body font, so each surface picks its own.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-serif",
});

export const metadata: Metadata = {
  title: "Brandish",
  description: "Nigerian business media — money, energy, FMCG and the brands shaping them.",
};

// Set the theme before first paint so there's no flash of the wrong mode. Reads the saved
// choice, else the OS preference. The public ThemeToggle and admin Settings both write this key.
const themeScript = `(function(){try{var t=localStorage.getItem('brandish-theme');if(t==='auto'||!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
