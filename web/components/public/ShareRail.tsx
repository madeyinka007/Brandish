"use client";

import { useEffect, useState } from "react";
import { Facebook, LinkedIn, Mail, Pinterest, XMark } from "./icons";

// Sticky vertical share rail. Reads the live URL on the client so share intents get the correct
// absolute link regardless of host.
export default function ShareRail({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "Facebook", Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "X", Icon: XMark, href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { name: "LinkedIn", Icon: LinkedIn, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "Pinterest", Icon: Pinterest, href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}` },
    { name: "Email", Icon: Mail, href: `mailto:?subject=${t}&body=${u}` },
  ];

  return (
    <div className="sticky top-24 flex flex-col items-center gap-2">
      <span className="pb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-900">Share</span>
      {links.map(({ name, Icon, href }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${name}`}
          className="flex h-9 w-9 items-center justify-center text-ink-700 transition-colors hover:text-accent"
        >
          <Icon size={18} />
        </a>
      ))}
    </div>
  );
}
