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
  title: "The Minhelet — WC2026",
  description: "פלטפורמת ההימורים הפרטית למונדיאל 2026. בנו את העץ, נחשו תוצאות, התחרו עם חברים.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "The Minhelet — FIFA World Cup 2026",
    description: "פלטפורמת ההימורים הפרטית למונדיאל 2026",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} ${assistant.variable} ${secularOne.variable} h-full`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5" />
        {/* Hide Vercel preview toolbar on deployments */}
        <meta name="vercel-toolbar" content="false" />
      </head>
      <body className="min-h-full w-full max-w-full overflow-x-hidden bg-gray-50 font-sans text-gray-900 antialiased" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
