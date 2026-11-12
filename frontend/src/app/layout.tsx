import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roomie — Find your kind of home",
  description: "A thoughtful, verified roommate matching experience."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
