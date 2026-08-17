import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

/**
 * Fonts and the document, nothing else.
 *
 * The phone shell that used to live here moved to `(capture)/layout.tsx`, so the
 * admin side can render full-width on a desktop — a layout nested under this one
 * composes with it and could not have escaped a `max-w-[430px]` wrapper.
 */

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
      {/* No colours here — globals.css paints the backdrop the phone shell sits on. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
