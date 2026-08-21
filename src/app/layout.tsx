import "./globals.css";
import { type Metadata, type Viewport } from "next";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { FamilyProvider } from "@/src/context/FamilyContext";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nadi-kelantan.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#08080A",
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "NADI — Platform Komuniti & Respons Bencana",
    template: "%s | NADI",
  },
  description:
    "Platform komuniti untuk aduan isu kawasan, amaran banjir dan paras air sungai, serta carian bantuan kebajikan & sukarelawan di Malaysia.",
  keywords: [
    "NADI",
    "Aduan Awam",
    "Aduan Jalan Berlubang",
    "Paras Air Sungai",
    "Amaran Banjir",
    "Bantuan Kebajikan",
    "Sukarelawan Malaysia",
  ],
  authors: [{ name: "NADI Malaysia Team" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.jpg",
    other: [
      {
        rel: "icon",
        type: "image/jpeg",
        url: "/favicon.jpg",
      },
    ],
  },
  openGraph: {
    title: "NADI — Platform Komuniti & Respons Bencana",
    description:
      "Platform komuniti untuk aduan isu kawasan, amaran banjir dan paras air sungai, serta carian bantuan kebajikan & sukarelawan di Malaysia.",
    url: baseUrl,
    siteName: "NADI",
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NADI",
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
        <link rel="icon" href="/favicon.ico" />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (${process.env.NODE_ENV === 'production'}) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                } else {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (let r of registrations) { r.unregister(); }
                  });
                }
              }
            `,
          }}
        />
      </head>
      <body className="antialiased text-white h-full w-full overflow-hidden" style={{ background: 'var(--bg-base, #0F0F11)' }}>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
                <FamilyProvider>
                    {children}
                </FamilyProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
