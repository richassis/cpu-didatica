import type { Metadata } from "next";
import { Urbanist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DEFAULT_TEXT_SIZE } from "@/lib/textSize";
import { LOCALE_BOOT_SCRIPT } from "@/lib/locale";

/**
 * Two families, rigid roles: Urbanist carries the chrome, JetBrains Mono
 * carries data.
 *
 * The mono is not a stylistic choice — hex needs tabular figures and a `0`
 * that cannot be confused with `O`, and Urbanist has neither. Never set a
 * numeric value in the sans.
 */
const sans = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const DESCRIPTION =
  "Simulador didático de CPU: escreva um programa em assembly e acompanhe, " +
  "tick a tick, o caminho de dados que o executa.";

// The card shown when the link is pasted into a chat or a social network. The
// image itself is `app/opengraph-image.png`, picked up by Next's file
// convention; `metadataBase` makes its URL absolute, which link previews need.
export const metadata: Metadata = {
  metadataBase: new URL("https://cpu-didatica.vercel.app"),
  title: "CPU Didática",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "CPU Didática",
    title: "CPU Didática",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "CPU Didática",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below stamps `data-theme`,
    // `data-text-size` and `lang` on <html> before React hydrates, so the
    // client DOM intentionally differs from the server HTML on these attributes.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
          Apply the persisted colour profile, text size and language before
          first paint, otherwise the app renders dark for a frame and then flips
          to light, or at the CSS's unscaled size and then shrinks. The text size
          is always written — the stored one, else the store's default — mapping
          legacy values the way displayStore's migrate does. The language follows
          `resolveLocale` (lib/locale.ts).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem("simulator-theme")||"{}");document.documentElement.dataset.theme=(t.state&&t.state.theme)||"dark"}catch(e){document.documentElement.dataset.theme="dark"}var z=${JSON.stringify(DEFAULT_TEXT_SIZE)};try{var d=JSON.parse(localStorage.getItem("simulator-display")||"{}");var s=d.state&&d.state.textSize;if(s==="small"||s==="medium"||s==="large")z=s;else if(s==="xlarge")z="large";else if(s)z="medium"}catch(e){}document.documentElement.dataset.textSize=z;${LOCALE_BOOT_SCRIPT}`,
          }}
        />
      </head>
      <body
        className={`${sans.variable} ${mono.variable} antialiased h-screen overflow-hidden`}
      >
        <div className="flex h-screen w-screen overflow-hidden bg-canvas">
          <main className="flex flex-col flex-1 min-h-0 min-w-0">{children}</main>
        </div>
        {/* Portal root for tooltips — rendered last in body, paints above every stacking context */}
        <div
          id="portal-root"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            overflow: "visible",
            zIndex: 999999,
            pointerEvents: "none",
          }}
        />
      </body>
    </html>
  );
}