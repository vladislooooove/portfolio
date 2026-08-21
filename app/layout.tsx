import type { Metadata, Viewport } from "next";
import { Syne, Geist, Geist_Mono } from "next/font/google";
import { PERSON } from "@/lib/content";
import "lenis/dist/lenis.css";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: `${PERSON.name} - ${PERSON.role}`,
  description:
    "10 years in web development. I build interfaces that stay fast, accessible, and easy to change.",
};

export const viewport: Viewport = {
  themeColor: "#0a0710",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="bg-void text-text font-sans antialiased">
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
