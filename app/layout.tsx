import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kudi: get paid from anywhere",
  description: "Get paid from anywhere, in real dollars, with your face.",
};

export const viewport: Viewport = {
  themeColor: "#232d7a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
