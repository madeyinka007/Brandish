import { FileText, ImageIcon, Music, Play } from "./icons";
import type { MediaRecord } from "@/lib/media";

export type MediaCategory = "image" | "video" | "audio" | "document";

export function mediaCategory(mimeType: string | null): MediaCategory {
  const m = (mimeType || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}

export const CATEGORY_LABEL: Record<MediaCategory, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
};

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function filenameOf(m: Pick<MediaRecord, "filename" | "url">): string {
  if (m.filename) return m.filename;
  try {
    const last = new URL(m.url).pathname.split("/").pop();
    return last ? decodeURIComponent(last) : m.url;
  } catch {
    return m.url;
  }
}

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-slate-500 to-slate-700",
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const ICON_FOR: Record<MediaCategory, (p: { width?: number; height?: number; className?: string }) => React.ReactNode> = {
  image: ImageIcon,
  video: Play,
  audio: Music,
  document: FileText,
};

/** Image preview for images; a gradient + type icon for everything else. */
export function Thumbnail({ media, iconSize = 26 }: { media: MediaRecord; iconSize?: number }) {
  const cat = mediaCategory(media.mimeType);
  if (cat === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={media.url}
        alt={filenameOf(media)}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = ICON_FOR[cat];
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(filenameOf(media))}`}>
      <Icon width={iconSize} height={iconSize} className="text-white/90" />
    </div>
  );
}
