"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createPost,
  updatePost,
  extractYouTubeId,
  type PostRecord,
  type PostPayload,
  type PostFormat,
  type PostStatus,
  type ApiError,
} from "@/lib/posts";
import { listCategories, type CategoryRecord } from "@/lib/categories";
import { listTags, type TagRecord } from "@/lib/tags";
import { listAuthors, type AuthorSummary } from "@/lib/users";
import { getStoredUser } from "@/lib/auth";
import { ROLE_META } from "@/components/admin/user-ui";
import { ColorDot, slugify } from "@/components/admin/category-ui";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { ArrowLeft, Check, FileText, ImageIcon, Play, User as UserIcon, X } from "@/components/admin/icons";

const EXCERPT_MAX = 220;

const FORMATS: { key: PostFormat; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "article", label: "Article", icon: FileText },
  { key: "gallery", label: "Gallery", icon: ImageIcon },
  { key: "video", label: "Video", icon: Play },
];

const STATUSES: PostStatus[] = ["draft", "published", "scheduled", "archived"];

function messageFor(err: ApiError): string {
  if (err.code === "GALLERY_MEDIA_REQUIRED") return "A gallery post needs at least one image.";
  if (err.code === "VIDEO_ID_REQUIRED") return "A video post needs a valid video URL.";
  if (err.code === "POST_NOT_FOUND") return "This post no longer exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't save the post. Please try again.";
  return err.message || "Unable to save the post.";
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PostEditor({ mode, initial }: { mode: "create" | "edit"; initial: PostRecord | null }) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState<unknown>(initial?.body ?? null);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [format, setFormat] = useState<PostFormat>(initial?.format ?? "article");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [ogImage, setOgImage] = useState(initial?.ogImage ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [media, setMedia] = useState<string[]>(initial?.media ?? []);
  const [videoUrl, setVideoUrl] = useState(initial?.videoId ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords ?? "");
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(toLocalInput(initial?.publishedAt ?? null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cats, setCats] = useState<CategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [authorId, setAuthorId] = useState(initial?.author?._id ?? getStoredUser()?._id ?? "");
  const [pickerTarget, setPickerTarget] = useState<null | "cover" | "gallery" | "og">(null);

  useEffect(() => {
    listCategories().then(setCats).catch(() => {});
    listTags().then(setAllTags).catch(() => {});
    listAuthors().then(setAuthors).catch(() => {});
  }, []);

  const authorName = initial?.author?.name ?? getStoredUser()?.name ?? "You";
  const slugPreview = mode === "edit" && initial ? initial.slug : slugify(title);
  const videoId = format === "video" ? extractYouTubeId(videoUrl) : "";
  const canSave = title.trim() !== "" && category !== "";

  function onPick(url: string) {
    if (pickerTarget === "cover") setCoverImage(url);
    else if (pickerTarget === "og") setOgImage(url);
    else if (pickerTarget === "gallery") setMedia((m) => (m.includes(url) ? m : [...m, url]));
  }

  function toggleTag(slug: string) {
    setTags((t) => (t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug]));
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Add a title.");
    if (!category) return setError("Choose a category.");
    if (format === "gallery" && media.length === 0) return setError("Add at least one image for a gallery post.");
    if (format === "video" && !videoId) return setError("Add a valid video URL for a video post.");
    setSaving(true);
    try {
      const payload: PostPayload = {
        title: title.trim(),
        body: body ?? { type: "doc", content: [] },
        excerpt: excerpt.trim(),
        format,
        coverImage,
        category,
        authorId: authorId || undefined,
        tags,
        media: format === "gallery" ? media : [],
        videoId: format === "video" ? videoId : null,
        keywords: keywords.trim(),
        ogImage,
        status,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      };
      if (mode === "edit" && initial) await updatePost(initial._id, payload);
      else await createPost(payload);
      router.push("/admin/posts");
    } catch (e) {
      setError(messageFor(e as ApiError));
      setSaving(false);
    }
  }

  const primaryLabel = saving
    ? "Saving…"
    : status === "published"
      ? "Publish"
      : status === "scheduled"
        ? "Schedule"
        : status === "archived"
          ? "Archive"
          : mode === "edit"
            ? "Save changes"
            : "Save draft";

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/posts" className="hover:text-slate-600">Posts</Link>
        <span>›</span>
        <span className="text-slate-600">{mode === "edit" ? "Edit Post" : "New Post"}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/posts" className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Back to posts">
            <ArrowLeft width={18} height={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{mode === "edit" ? "Edit Post" : "New Post"}</h1>
            <p className="mt-1 text-sm text-slate-500">Write the content, pick a format, then publish or save as a draft.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/posts" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</Link>
          <button onClick={submit} disabled={saving || !canSave} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
            {primaryLabel}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="w-full text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
            />
            <p className="mt-1 text-xs text-slate-400">
              Permalink: <span className="font-mono text-slate-500">brandish.co/{category || "category"}/{slugPreview || "…"}</span>
              {mode === "create" && " (generated from the title on save)"}
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Body</label>
              <RichTextEditor initialContent={initial?.body ?? undefined} onChange={setBody} placeholder="Write the post…" />
            </div>
          </section>

          {/* format-specific card */}
          {format === "gallery" && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Gallery images</h2>
                  <p className="text-sm text-slate-500">{media.length} selected · the first image is the cover.</p>
                </div>
                <button type="button" onClick={() => setPickerTarget("gallery")} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
                  + Add images
                </button>
              </div>
              {media.length === 0 ? (
                <button type="button" onClick={() => setPickerTarget("gallery")} className="mt-4 flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 hover:border-brand hover:text-brand">
                  Select images from the media library
                </button>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {media.map((url, i) => (
                    <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                      <button type="button" onClick={() => setMedia((m) => m.filter((u) => u !== url))} className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                        <X width={12} height={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {format === "video" && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Video source</h2>
              <p className="text-sm text-slate-500">Paste a YouTube link — the video id is extracted and stored.</p>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                className={`${inputCls} mt-3`}
              />
              {videoId ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" className="h-14 w-24 rounded object-cover" />
                  <div className="text-sm">
                    <p className="font-medium text-emerald-700">✓ YouTube video detected</p>
                    <p className="font-mono text-xs text-slate-500">id: {videoId}</p>
                  </div>
                </div>
              ) : (
                videoUrl && <p className="mt-2 text-xs text-amber-600">Couldn’t detect a YouTube id — check the URL.</p>
              )}
            </section>
          )}

          {/* excerpt */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Excerpt</h2>
              <span className="text-xs text-slate-400">{excerpt.length} / {EXCERPT_MAX}</span>
            </div>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value.slice(0, EXCERPT_MAX))}
              rows={2}
              placeholder="Shown in listing cards and social/OG previews."
              className={`${inputCls} resize-none`}
            />
          </section>
        </div>

        {/* right column */}
        <div className="space-y-6">
          {/* publish */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Publish</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PostStatus)} className={inputCls}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              {(status === "scheduled" || status === "published") && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {status === "scheduled" ? "Publish at" : "Published at"}
                  </label>
                  <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={inputCls} />
                  {status === "published" && <p className="mt-1 text-xs text-slate-400">Leave blank to use now.</p>}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Author</label>
                {authors.length > 0 ? (
                  <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={inputCls}>
                    {/* keep the current author selectable even if not in the fetched pool */}
                    {authorId && !authors.some((a) => a._id === authorId) && (
                      <option value={authorId}>{authorName}</option>
                    )}
                    {authors.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} · {ROLE_META[a.role]?.label ?? a.role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <UserIcon width={15} height={15} /> {authorName}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">Assign to any teammate with create-post access.</p>
              </div>
            </div>
          </section>

          {/* format */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Post format</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const active = format === f.key;
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition ${
                      active ? "border-brand bg-brand-soft/60 text-brand ring-1 ring-brand" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Icon width={18} height={18} />
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">Format changes what the editor collects on the left.</p>
          </section>

          {/* featured image */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Featured image</h2>
            {coverImage ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
              </div>
            ) : (
              <button type="button" onClick={() => setPickerTarget("cover")} className="mt-3 flex aspect-[16/9] w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 hover:border-brand hover:text-brand">
                <ImageIcon width={22} height={22} />
              </button>
            )}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setPickerTarget("cover")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                {coverImage ? "Replace" : "Select from library"}
              </button>
              {coverImage && (
                <button type="button" onClick={() => setCoverImage("")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">Remove</button>
              )}
            </div>
          </section>

          {/* category */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Category</h2>
            <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
              {cats.length === 0 ? (
                <p className="text-sm text-slate-400">No categories — add one first.</p>
              ) : (
                cats.map((c) => (
                  <label key={c._id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="radio" name="category" checked={category === c.slug} onChange={() => setCategory(c.slug)} className="accent-[color:var(--color-brand)]" />
                    <ColorDot color={c.color} />
                    <span className="text-slate-700">{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          {/* tags */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Tags</h2>
            <p className="text-xs text-slate-400">Click to add or remove.</p>
            <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {allTags.length === 0 ? (
                <p className="text-sm text-slate-400">No tags yet.</p>
              ) : (
                allTags.map((t) => {
                  const on = tags.includes(t.slug);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => toggleTag(t.slug)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        on ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {on && <Check width={11} height={11} strokeWidth={3} />}
                      {t.name}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* SEO */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">SEO &amp; metadata</h2>
            <div className="mt-3 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Meta keywords</label>
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="comma, separated, keywords" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">og:image</label>
                {ogImage && (
                  <div className="mb-2 overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ogImage} alt="" className="aspect-[1.9/1] w-full object-cover" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPickerTarget("og")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    {ogImage ? "Replace" : "Select from library"}
                  </button>
                  {ogImage && <button type="button" onClick={() => setOgImage("")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">Remove</button>}
                </div>
                <p className="mt-1 text-xs text-slate-400">Falls back to the featured image if left empty.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <MediaPickerModal open={pickerTarget !== null} onClose={() => setPickerTarget(null)} onSelect={onPick} />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";
