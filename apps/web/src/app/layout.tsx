import { ThemeProvider } from "@/components/theme-provider";
import { envConfig } from "@/config/env-config";
import { externalUrls, sitePaths } from "@/config/paths-config";
import { APP_NAME } from "@/content/homepage";
import { AuthProvider } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Chakra_Petch({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500", "600", "700"],
});

const title = `${APP_NAME} — ${externalUrls.descriptionShort}`;
const siteUrl = externalUrls.site;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description: externalUrls.descriptionShort,
  alternates: {
    canonical: sitePaths.home,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: APP_NAME,
    title,
    description: externalUrls.descriptionShort,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: externalUrls.descriptionShort,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        fontSans.variable,
        fontMono.variable,
        "min-h-screen antialiased font-sans",
      )}
    >
      {envConfig.IS_DEV && (
        <head>
          <script
            async
            crossOrigin="anonymous"
            src="https://tweakcn.com/live-preview.min.js"
          />
        </head>
      )}
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <div className="flex flex-1 flex-col">{children}</div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
