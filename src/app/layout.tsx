import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DentaFlow — Gestion du cabinet dentaire",
    template: "%s · DentaFlow",
  },
  description:
    "Gestion du cabinet dentaire : dossiers patients, agenda, actes, paiements et documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      lang="fr"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsAdapter>
            <TRPCReactProvider>
              {children}
              <Toaster />
            </TRPCReactProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
