import type { Metadata } from "next";
import { Alice, Karla, Dancing_Script } from "next/font/google";
import "./globals.css";
import { LangProvider } from "./providers";
import { LangSwitcher } from "./lang-switcher";

const alice = Alice({
  variable: "--font-alice",
  subsets: ["latin"],
  weight: "400",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BLOOM",
  description: "Un jeu de cartes hybride coopératif et de trahison",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${alice.variable} ${karla.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-bloom-cream-light text-bloom-gray-dark">
        <LangProvider>
          <LangSwitcher className="fixed bottom-4 right-4 z-50" />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
