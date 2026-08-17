import Link from "next/link";
import { type Category, categoryHref } from "@/lib/site";
import { SOCIAL } from "./icons";
import NewsletterForm from "./NewsletterForm";

const PAD = "px-5 tab:px-8 lap:px-10 wide:px-[120px]";

const QUICK = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about" },
  { label: "Advertise with Us", href: "#" },
  { label: "Contact Us", href: "#" },
];

export default function SiteFooter({ title, categories }: { title: string; categories: Category[] }) {
  const year = new Date().getFullYear();
  const cols: { label: string; items: { label: string; href: string }[] }[] = [
    { label: "Quick Menu", items: QUICK },
    {
      label: "Categories",
      items: categories.slice(0, 6).map((c) => ({ label: c.name, href: categoryHref(c.slug) })),
    },
    { label: "Socials", items: SOCIAL.map((s) => ({ label: s.name, href: s.href })) },
  ];

  return (
    <footer className={`flex flex-col gap-10 bg-surface-footer py-14 text-white sm:py-20 ${PAD}`}>
      {/* Brand bar */}
      <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[#2e2e2e] pb-10 max-tab:flex-col max-tab:justify-center max-tab:text-center">
        <Link href="/" aria-label={title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brandish-logo-footer.png" alt={title} className="h-10 w-auto sm:h-12" />
        </Link>
        <div className="flex gap-5 text-[#f5f5f5]">
          {SOCIAL.map(({ name, Icon, href }) => (
            <a key={name} href={href} aria-label={name} className="transition-colors hover:-translate-y-px hover:text-accent">
              <Icon size={20} />
            </a>
          ))}
        </div>
      </div>

      {/* Link grid + newsletter */}
      <div className="grid grid-cols-1 gap-10 tab:grid-cols-2 lap:grid-cols-[1fr_1fr_1fr_2fr]">
        {cols.map((c) => (
          <div key={c.label} className="hidden flex-col gap-3 tab:flex">
            <h3 className="text-[14px] font-bold uppercase tracking-[0.04em] text-white">{c.label}</h3>
            {c.items.map((i) => (
              <Link key={i.label} href={i.href} className="text-[15px] leading-loose text-[#f5f5f5] transition-colors hover:text-accent">
                {i.label}
              </Link>
            ))}
          </div>
        ))}

        <div id="newsletter" className="flex scroll-mt-24 flex-col gap-4 max-tab:items-center max-tab:text-center">
          <h3 className="text-[20px] font-bold text-white">Subscribe to Updates</h3>
          <p className="text-[15px] leading-[1.7] text-[#d6d6d6]">
            Get Brandish news in your inbox — the latest reporting on money, energy, FMCG and the brands shaping them.
          </p>
          <NewsletterForm variant="dark" />
        </div>
      </div>

      {/* Legal */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2e2e2e] pt-6 text-[13px] text-[#a8a8a8] max-tab:flex-col max-tab:items-center max-tab:gap-3 max-tab:text-center">
        <div>© {year} Brandish. All rights reserved.</div>
        <div className="flex gap-6">
          <a href="#" className="text-[#d6d6d6] hover:text-white">Privacy Policy</a>
          <a href="#" className="text-[#d6d6d6] hover:text-white">Terms of Use</a>
        </div>
      </div>
    </footer>
  );
}
