import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ResumeEvolver",
    template: "%s | ResumeEvolver",
  },
  description:
    "A private-first career evidence ledger for collecting proof of real work and generating traceable drafts from approved evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
