import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers/Providers";
import AppHeader from "@/components/AppHeader";
import AppNav from "@/components/AppNav";
import ToasterProvider from "@/components/providers/ToasterProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daily AI",
  description: "Daily time-based task manager with intelligent scheduling.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#3B82F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <AppHeader />
          <AppNav />
          {children}
          <ToasterProvider />
        </Providers>
      </body>
    </html>
  );
}
