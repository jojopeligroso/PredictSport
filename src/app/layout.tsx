import type { Metadata } from "next";
import { Inter, Bebas_Neue, Instrument_Serif } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PredictSport — Social Sports Predictions",
  description: "Social sports prediction platform for friend groups",
  openGraph: {
    title: "PredictSport",
    description: "Predict. Compete. Have the craic.",
    type: "website",
    url: "https://predictsport-rust.vercel.app",
    siteName: "PredictSport",
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
      className={`${inter.variable} ${bebasNeue.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ps-bg text-ps-text">
        <NavBar />
        <main className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-[480px] px-4">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
