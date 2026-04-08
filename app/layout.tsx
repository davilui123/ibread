import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"; // Adicionada Instrument_Serif
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Essa é a fonte que vai dar a cara de "Logo" para o IBRead
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
  style: "italic",
});

export const metadata: Metadata = {
  title: "IBRead | Sua Estante Digital",
  description: "Gerenciador pessoal de leitura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-br"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="h-full bg-[#F8F9F7] selection:bg-[#B4ACCF]/30">
        {children}
      </body>
    </html>
  );
}