import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ThemeRegistry from "../components/ThemeRegistry";
import { TopAppBar, BottomNav } from "../components/Navigation";
import { CartProvider } from "../context/CartContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Entropi E-commerce",
  description: "Trackable transaction system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeRegistry options={{ key: 'mui' }}>
          <CartProvider>
            <TopAppBar />
            <div style={{ paddingBottom: '70px' }}>{/* Padding bottom for BottomNavigation */}
              {children}
            </div>
            <BottomNav />
          </CartProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
