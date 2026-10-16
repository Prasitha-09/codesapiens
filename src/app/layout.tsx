import type { Metadata } from "next";

import { Suspense } from "react";


import { SiteFooter } from "@/components/layout/site-footer";

import { SiteHeader } from "@/components/layout/site-header";


import "./globals.css";

import { AppChrome } from "@/components/layout/app-chrome";



export const metadata: Metadata = {

  title: {

    default: "SAPIENS CAMPUS — Live Quiz Arena",

    template: "%s · SAPIENS CAMPUS",

  },

  description: "Team up, answer live questions, and compete on the SAPIENS CAMPUS team leaderboard.",

};



export default function RootLayout({ children }: LayoutProps<"/">) {

  return (

    <html lang="en" className="h-full">

      <body className="flex min-h-full flex-col">

        <a

          href="#main"

          className="sr-only z-50 border-[3px] border-ink bg-mint px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"

        >

          Skip to content

        </a>

        <Suspense fallback={<main id="main" className="p-8">Loading arena…</main>}><AppChrome header={<SiteHeader />} footer={<SiteFooter />}>{children}</AppChrome></Suspense>

      </body>

    </html>

  );

}

