import Link from "next/link";

// Minimal placeholder homepage — the public blog (web/) is built separately. This app's
// focus right now is the admin dashboard at /admin.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">
          B
        </span>
        <span className="text-2xl font-bold">Brandish</span>
      </div>
      <p className="max-w-md text-slate-500">
        The public blog lives here. The content team manages everything from the admin dashboard.
      </p>
      <Link
        href="/admin/login"
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white transition hover:bg-brand-dark"
      >
        Go to admin →
      </Link>
    </main>
  );
}
