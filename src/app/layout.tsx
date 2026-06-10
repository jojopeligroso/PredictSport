import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif, Noto_Sans } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { GlobalChromeGuard } from "@/components/GlobalChromeGuard";
import { PushPromptWrapper } from "@/components/PushPromptWrapper";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
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
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${notoSans.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="sportspredict." />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-ps-bg text-ps-text">
        <ThemeProvider>
          <LocaleProvider>
            {!shellMode && (
              <GlobalChromeGuard>
                <NavBar />
              </GlobalChromeGuard>
            )}
            <main className="flex flex-1 flex-col">
              {children}
            </main>
            {!shellMode && (
              <GlobalChromeGuard>
                <Footer />
              </GlobalChromeGuard>
            )}
            <PushPromptWrapper />
            <ServiceWorkerRegistration />
            <InstallPrompt />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
