import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CustomProvider } from "./providers/query-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "nextjs-bun-redis-convex-turborepo-starter",
    description: "Next.js monorepo with Bun, Redis, Convex, and Turborepo",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <CustomProvider>
                    {children}
                    <ReactQueryDevtools initialIsOpen={false} />
                </CustomProvider>
            </body>
        </html>
    );
}
