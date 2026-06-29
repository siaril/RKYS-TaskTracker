import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rekayasa Task Tracker",
  description: "Kanban task tracker for teams",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCookie = (await cookies()).get("theme")?.value;
  const isDark = themeCookie === "dark";

  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased${isDark ? " dark" : ""}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
