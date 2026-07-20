const LINKS = ["Documentation", "Support", "Changelog", "Privacy", "Terms"];
const VERSION = "v2.4.1";

// Dashboard footer (Figma node 38:2) — copyright + version on the left, links + system-status
// pill on the right.
export default function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-400">
      <div className="flex items-center gap-2">
        <span>&copy; {new Date().getFullYear()} Brandish. All rights reserved.</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>{VERSION}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <nav className="flex flex-wrap items-center gap-4 sm:gap-5">
          {LINKS.map((label) => (
            <a key={label} href="#" className="text-slate-500 transition hover:text-slate-700">
              {label}
            </a>
          ))}
        </nav>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          All systems operational
        </span>
      </div>
    </footer>
  );
}
