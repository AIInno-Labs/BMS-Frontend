import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FRP Engineering — Fabrication Intelligence",
  description:
    "Enterprise fibre reinforced plastic fabrication management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body
        className={`${GeistSans.className} flex min-h-dvh flex-col overflow-x-hidden font-sans print:overflow-visible print:min-h-0`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
