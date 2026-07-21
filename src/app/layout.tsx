import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stockroom", template: "%s | Stockroom" },
  description: "A focused warehouse inventory manager for small operations teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
