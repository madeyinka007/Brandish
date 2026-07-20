"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/admin/Sidebar";
import Topbar from "@/components/admin/Topbar";
import Footer from "@/components/admin/Footer";

// Client-side auth gate. This is UX only — the real boundary is the API (the Lambda
// authorizer + requireRole re-check every /api/admin/* call). Renders nothing until the
// token check resolves, so the dashboard never flashes for a signed-out visitor.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/admin/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* Scroll region holds the page + footer; footer sticks to the bottom on short pages. */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <main className="flex-1 p-6">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
