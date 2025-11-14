import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";
import PageLoader from "./components/PageLoader";
import { AuthProvider } from "./utils/authContext";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Anonium",
  description: "Anonium - インターネットの匿名的元素",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24..48,300..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        <PageLoader animationDuration={4000} size={60} />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
