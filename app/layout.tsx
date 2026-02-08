import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FWG OPS",
  description: "Frederick Wraps Operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

