import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoriUI",
  description: "Visualizador de algoritmos com TypeScript, JavaScript e Python"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
