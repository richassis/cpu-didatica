import type { Metadata } from "next";
import { Urbanist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "CPU Simulator",
  description: "Interactive CPU didactic simulator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below stamps `data-theme` on
    // <html> before React hydrates, so the client DOM intentionally differs from
    // the server HTML on this one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Apply the persisted colour profile before first paint, otherwise the
          app renders dark for a frame and then flips to light.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem("simulator-theme")||"{}");document.documentElement.dataset.theme=(t.state&&t.state.theme)||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`,
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