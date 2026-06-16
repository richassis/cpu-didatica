import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-hidden`}
      >
        <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
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