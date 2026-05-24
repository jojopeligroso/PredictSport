import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif, Noto_Sans } from "next/font/google";
import { headers } from "next/headers";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { PushPromptWrapper } from "@/components/PushPromptWrapper";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { isWorldCupShell } from "@/lib/product-mode";
import "./globals.css";

export const dynamic = "force-dynamic";

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

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shellMode = isWorldCupShell();
  const pathname = (await headers()).get("x-pathname") ?? "";
  // The /wc/* segment ships its own shell nav (and footer), so hide the global
  // chrome there to avoid two stacked sportspredict. bars.
  const inWorldCupShellRoute = pathname.startsWith("/wc");
  const showGlobalChrome = !shellMode && !inWorldCupShellRoute;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${notoSans.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-ps-bg text-ps-text">
        <ThemeProvider>
          {showGlobalChrome && <NavBar />}
          <main className="flex flex-1 flex-col">
            {children}
          </main>
          {showGlobalChrome && <Footer />}
          <PushPromptWrapper />
        </ThemeProvider>
      </body>
    </html>
  );
}
