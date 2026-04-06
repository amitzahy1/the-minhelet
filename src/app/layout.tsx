import type { Metadata } from "next";
import { Inter, Assistant, Secular_One } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const secularOne = Secular_One({
  variable: "--font-secular",
  subsets: ["hebrew", "latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "WC2026 — World Cup Prediction Pool",
  description:
    "Private prediction platform for FIFA World Cup 2026. Build your bracket, predict match scores, compete with friends.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} ${assistant.variable} ${secularOne.variable} h-full`}>
      <body className="min-h-full bg-gray-50 font-sans text-gray-900 antialiased" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
