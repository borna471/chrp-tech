import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { demoConfig } from "@/lib/demoConfig";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Chrp Healthy Homes — Photo assessment",
  description:
    "Capture the photos your home assessment needs. No login, no app to install.",
};

export const viewport: Viewport = {
  themeColor: "#0d3a4f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        <main className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg text-ink">
          <AppHeader policyRef={demoConfig.policyRef} />
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
