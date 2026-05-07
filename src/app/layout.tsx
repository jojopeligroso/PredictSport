import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
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

export const metadata: Metadata = {
  title: "PredictSport — The Sheet",
  description: "Social sports prediction platform for friend groups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bebasNeue.variable} h-full antialiased`}
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
