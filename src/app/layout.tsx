import "./globals.css";
import { type Metadata } from "next";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { GameProvider } from "@/src/context/GameContext";
import { FamilyProvider } from "@/src/context/FamilyContext";
import { GamificationProvider } from "@/src/components/Gamification";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nadi-kelantan.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "NADI — Sistem Operasi Sivik & Respons Bencana Kebangsaan",
    template: "%s | NADI",
  },
  description:
    "Platform Operasi Sivik & Respons Bencana Kebangsaan Malaysia. Pemantauan paras air JPS, aduan jalan berlubang dialek AI Groq Llama 3.3, dan padanan bantuan B40.",
  keywords: [
    "NADI",
    "Sistem Operasi Sivik",
    "Aduan Pothole Malaysia",
    "JPS Kelantan River Level",
    "Respons Bencana Banjir",
    "AI Dialek Kelantan",
    "Bantuan Komuniti B40",
  ],
  authors: [{ name: "NADI Malaysia Team" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.jpg", type: "image/jpeg" },
      { url: "/icon.jpg", type: "image/jpeg" },
    ],
    apple: "/favicon.jpg",
  },
  openGraph: {
    title: "NADI — Sistem Operasi Sivik & Respons Bencana Kebangsaan",
    description:
      "Platform Operasi Sivik & Respons Bencana Kebangsaan Malaysia. Pemantauan paras air JPS, aduan dialek AI Groq Llama 3.3, dan padanan bantuan B40.",
    url: baseUrl,
    siteName: "NADI National Dashboard",
    locale: "ms_MY",
    type: "website",
    images: [
      {
        url: "/favicon.jpg",
        width: 1200,
        height: 630,
        alt: "NADI — National Civic Operations Dashboard Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NADI — Sistem Operasi Sivik & Respons Bencana Kebangsaan",
    description:
      "Platform Operasi Sivik & Respons Bencana Kebangsaan Malaysia. Pemantauan paras air JPS, aduan dialek AI Groq Llama 3.3, dan padanan bantuan B40.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NADI",
    operatingSystem: "Web",
    applicationCategory: "GovernmentApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "MYR",
    },
    description:
      "Platform Operasi Sivik & Respons Bencana Kebangsaan Malaysia. Pemantauan paras air JPS, aduan dialek AI Groq Llama 3.3, dan padanan bantuan B40.",
    publisher: {
      "@type": "Organization",
      name: "NADI Malaysia",
      url: baseUrl,
    },
  };

  return (
    <html lang="ms" className="dark">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased bg-[#050507] text-white">
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              <GameProvider>
                <FamilyProvider>
                  <GamificationProvider>
                    {children}
                  </GamificationProvider>
                </FamilyProvider>
              </GameProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
