"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * GA4 measurement ID. It ships in the page source, so it is public by nature — putting it in
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is only about being able to swap properties per environment.
 * The literal below is the fallback so builds that don't set the env var (e.g. an Amplify build
 * whose console env var hasn't been added yet) still report.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-X97JYWWDPV";

/**
 * The admin dashboard is staff-only. Tracking it would mix editor sessions into reader
 * analytics and pollute the page paths with /admin/*. The public site never links into the
 * dashboard, so skipping the script on those routes is enough to keep admin traffic out.
 */
function isPublicRoute(pathname: string | null): boolean {
  return pathname !== null && !pathname.startsWith("/admin");
}

/**
 * Google Analytics 4 (gtag.js).
 *
 * Route changes are picked up automatically by GA's Enhanced Measurement ("Page changes based on
 * browser history events"), which is on by default for web data streams and hooks
 * history.pushState — the mechanism Next.js' App Router uses for <Link> navigation. Do NOT also
 * send page_view events from here: with enhanced measurement on, that double-counts every page.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();

  if (!isPublicRoute(pathname)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
