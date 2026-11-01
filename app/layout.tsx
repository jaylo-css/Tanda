import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SkipLink } from "@/components/SkipLink";

// Atkinson Hyperlegible was designed by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tanda - Para sa matanda, para matandaan",
  description:
    "Tanda helps Filipino seniors and their families understand their medicines with a clear Tagalog version of the doctor's prescription.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b5d4b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fil" className={atkinson.variable}>
      <body className="flex min-h-dvh flex-col">
        <LangProvider>
          <SkipLink />
          <Header />
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6">
            {children}
          </main>
          <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
