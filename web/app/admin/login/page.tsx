"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, isAuthenticated } from "@/lib/auth";
import type { ApiError } from "@/lib/api";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
} from "@/components/admin/icons";

const FEATURES = [
  "Unified content and media library",
  "Role-based access for every team",
  "Real-time campaign analytics",
];

function messageFor(err: ApiError): string {
  switch (err.code) {
    case "INVALID_CREDENTIALS":
    case "INVALID_CREDENTIALS_FORMAT":
      return "Invalid email or password.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email before signing in.";
    default:
      return err.status === 500
        ? "We couldn't sign you in right now. Please try again."
        : err.message || "Unable to sign in.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → skip the form.
  useEffect(() => {
    if (isAuthenticated()) router.replace("/admin");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/admin");
    } catch (err) {
      setError(messageFor(err as ApiError));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left — brand / value panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#1c1c38] via-[#171730] to-[#0f0f1e] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-bold">
            B
          </span>
          <span className="text-lg font-semibold">Brandish</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Every brand story,
            <br />
            managed in one place.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Publish content, organise taxonomies, run campaigns and track performance — all
            from the Brandish admin.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/90">
                  <Check width={13} height={13} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <figure className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <blockquote className="text-sm leading-relaxed text-slate-200">
            &ldquo;Brandish cut our publishing workflow from three tools down to one. Our
            editors ship twice as fast now.&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <span className="h-8 w-8 rounded-full bg-amber-400" />
            <span className="text-xs">
              <span className="block font-semibold text-white">Ngozi Eze</span>
              <span className="text-slate-400">Head of Content, Lumen Studio</span>
            </span>
          </figcaption>
        </figure>
      </aside>

      {/* Right — sign-in form */}
      <section className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Sign in to Brandish</h2>
          <p className="mt-2 text-sm text-slate-500">
            Welcome back. Enter your details to access the admin dashboard.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adaeze@brandish.co"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <a href="#" className="text-sm font-medium text-brand hover:text-brand-dark">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand accent-[color:var(--color-brand)]"
              />
              Keep me signed in for 30 days
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight width={16} height={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&rsquo;t have an account?{" "}
            <a href="#" className="font-medium text-brand hover:text-brand-dark">
              Request access
            </a>
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-2.5 text-xs text-slate-500">
            <Shield width={14} height={14} />
            Protected by two-factor authentication for admin accounts.
          </div>
        </div>
      </section>
    </main>
  );
}
