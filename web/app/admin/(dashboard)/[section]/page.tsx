"use client";

import { use } from "react";

// Placeholder for admin sections not built yet (Content, Category, Users, Media, …). Keeps
// the sidebar navigable and the production build green until each section is implemented.
// The `login` segment is a separate static route, so it never lands here.
export default function SectionPlaceholder({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const title = section.charAt(0).toUpperCase() + section.slice(1);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">This section is coming soon.</p>

      <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
        {title} management will live here.
      </div>
    </div>
  );
}
