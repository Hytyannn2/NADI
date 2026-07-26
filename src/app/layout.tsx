import "./globals.css";
import { type Metadata } from "next";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { GameProvider } from "@/src/context/GameContext";
import { FamilyProvider } from "@/src/context/FamilyContext";
import { GamificationProvider } from "@/src/components/Gamification";

export const metadata: Metadata = {
  title: "NADI",
  description: "Next Generation Civic Operations System for Malaysia",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
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
