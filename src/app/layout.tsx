import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { PushPromptWrapper } from "@/components/PushPromptWrapper";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sportspredict. — Call it, then rub it in Gerry Ramos' face.",
  description: "Social sports prediction platform for friend groups",
  openGraph: {
    title: "sportspredict.",
    description: "Call it, then rub it in Gerry Ramos' face.",
    type: "website",
    url: "https://predictsport-rust.vercel.app",
    siteName: "sportspredict.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full flex flex-col bg-ps-bg text-ps-text">
        <NavBar />
        <main className="flex flex-1 flex-col">
          {children}
        </main>
        <Footer />
        <PushPromptWrapper />
      </body>
    </html>
  );
}
