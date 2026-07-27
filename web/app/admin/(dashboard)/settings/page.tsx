"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { getStoredUser } from "@/lib/auth";
import {
  getSettings,
  updateSettings,
  type Settings,
  type SettingsPatch,
  type ThemeMode,
} from "@/lib/settings";
import { getMe, updateProfile, changePassword, type Me } from "@/lib/profile";
import { Avatar } from "@/components/admin/user-ui";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import {
  Camera,
  Check,
  FileText,
  ImageIcon,
  Lock,
  Mail,
  MessageSquare,
  Settings as SettingsIcon,
  User,
} from "@/components/admin/icons";

type TabKey = "site" | "profile" | "appearance" | "reading" | "comments";
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const TABS: { key: TabKey; label: string; icon: Icon }[] = [
  { key: "site", label: "Site settings", icon: SettingsIcon },
  { key: "profile", label: "Profile information", icon: User },
  { key: "appearance", label: "Appearance", icon: ImageIcon },
  { key: "reading", label: "Reading", icon: FileText },
  { key: "comments", label: "Comments", icon: MessageSquare },
];

const ACCENTS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#111827"];
const LANGUAGES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-NG", label: "English (Nigeria)" },
  { value: "fr-FR", label: "French (France)" },
];
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York", "UTC"];
const FONTS = ["Inter", "System UI", "Georgia", "Merriweather", "Roboto"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400";

/* ------------------------------ field primitives ------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3.5 first:border-t-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls}>
      {children}
    </select>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  );
}

/* --------------------------------- the page ----------------------------------- */

export default function SettingsPage() {
  const role = getStoredUser()?.role;
  const canEditSite = role === "super-admin";

  const [tab, setTab] = useState<TabKey>("site");
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [profileSaved, setProfileSaved] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Me | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [logoPicker, setLogoPicker] = useState(false);
  const [avatarPicker, setAvatarPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSettings().catch(() => null), getMe().catch(() => null)])
      .then(([s, me]) => {
        if (cancelled) return;
        setSaved(s);
        setDraft(s ? structuredClone(s) : null);
        setProfileSaved(me);
        setProfile(me ? { ...me } : null);
        if (!s && !me) setError("Failed to load settings.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const settingsDirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const profileDirty = useMemo(() => {
    if (!profile || !profileSaved) return false;
    return (["name", "firstName", "lastName", "bio", "email", "avatar"] as const).some((k) => profile[k] !== profileSaved[k]);
  }, [profile, profileSaved]);
  const dirty = settingsDirty || profileDirty;

  function setSite<K extends keyof Settings["site"]>(key: K, value: Settings["site"][K]) {
    setDraft((d) => (d ? { ...d, site: { ...d.site, [key]: value } } : d));
  }
  function setAppearance<K extends keyof Settings["appearance"]>(key: K, value: Settings["appearance"][K]) {
    setDraft((d) => (d ? { ...d, appearance: { ...d.appearance, [key]: value } } : d));
  }
  function setReading<K extends keyof Settings["reading"]>(key: K, value: Settings["reading"][K]) {
    setDraft((d) => (d ? { ...d, reading: { ...d.reading, [key]: value } } : d));
  }
  function setComments<K extends keyof Settings["comments"]>(key: K, value: Settings["comments"][K]) {
    setDraft((d) => (d ? { ...d, comments: { ...d.comments, [key]: value } } : d));
  }
  function setProfileField<K extends keyof Me>(key: K, value: Me[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  function discard() {
    setDraft(saved ? structuredClone(saved) : null);
    setProfile(profileSaved ? { ...profileSaved } : null);
    setError(null);
    setNotice(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Settings (super-admin) — send only changed sections.
      if (settingsDirty && draft && saved && canEditSite) {
        const patch: SettingsPatch = {};
        (["site", "appearance", "reading", "comments"] as const).forEach((sec) => {
          if (JSON.stringify(draft[sec]) !== JSON.stringify(saved[sec])) patch[sec] = draft[sec] as never;
        });
        const next = await updateSettings(patch);
        setSaved(next);
        setDraft(structuredClone(next));
        applyTheme(next.appearance.theme);
      }
      // Profile (self) — any signed-in user.
      if (profileDirty && profile) {
        const me = await updateProfile({
          name: profile.name,
          firstName: profile.firstName,
          lastName: profile.lastName,
          bio: profile.bio,
          email: profile.email,
          avatar: profile.avatar,
        });
        setProfileSaved(me);
        setProfile({ ...me });
      }
      setNotice("Your changes have been saved.");
    } catch (e) {
      setError((e as Error).message || "Couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  }

  // Apply the chosen theme to the document (persists per-browser; site default comes from settings).
  useEffect(() => {
    if (saved?.appearance.theme) applyTheme(saved.appearance.theme);
  }, [saved?.appearance.theme]);

  if (loading) {
    return <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white px-4 py-24 text-center text-slate-400">Loading settings…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Configure how your blog looks, reads and behaves.</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </span>
          )}
          <button
            onClick={discard}
            disabled={!dirty || saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* sub-nav */}
        <nav className="h-fit rounded-xl border border-slate-200 bg-white p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon width={16} height={16} /> {t.label}
              </button>
            );
          })}
        </nav>

        {/* panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {!canEditSite && tab !== "profile" && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Only super-admins can change site settings. These fields are read-only for your role.
            </div>
          )}

          {draft && tab === "site" && (
            <div className="space-y-5">
              <SectionHead title="Site settings" sub="How your blog presents itself to readers." />
              <Field label="Site title">
                <input value={draft.site.title} disabled={!canEditSite} onChange={(e) => setSite("title", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Logo" hint="Pick an image from your Media library. SVG or PNG with a transparent background works best.">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {draft.site.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.site.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-lg font-bold text-brand">B</span>
                    )}
                  </div>
                  <button type="button" disabled={!canEditSite} onClick={() => setLogoPicker(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    Choose from library
                  </button>
                  {draft.site.logoUrl && canEditSite && (
                    <button type="button" onClick={() => setSite("logoUrl", "")} className="text-sm font-medium text-rose-600 hover:text-rose-700">Remove</button>
                  )}
                </div>
              </Field>
              <Field label="Tagline">
                <input value={draft.site.tagline} disabled={!canEditSite} onChange={(e) => setSite("tagline", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Site description">
                <textarea value={draft.site.description} disabled={!canEditSite} onChange={(e) => setSite("description", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Site language">
                  <Select value={draft.site.language} disabled={!canEditSite} onChange={(v) => setSite("language", v)}>
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </Select>
                </Field>
                <Field label="Timezone">
                  <Select value={draft.site.timezone} disabled={!canEditSite} onChange={(v) => setSite("timezone", v)}>
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Posts per page">
                <Select value={draft.site.postsPerPage} disabled={!canEditSite} onChange={(v) => setSite("postsPerPage", Number(v))}>
                  {[6, 9, 12, 18, 24].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
              <div className="pt-1">
                <ToggleRow label="Show author bylines" checked={draft.site.showAuthorBylines} disabled={!canEditSite} onChange={(v) => setSite("showAuthorBylines", v)} />
                <ToggleRow label="Enable comments" checked={draft.site.enableComments} disabled={!canEditSite} onChange={(v) => setSite("enableComments", v)} />
                <ToggleRow label="Enable RSS feed" checked={draft.site.enableRss} disabled={!canEditSite} onChange={(v) => setSite("enableRss", v)} />
                <ToggleRow label="Maintenance mode" hint="Show a maintenance page to readers; the admin stays available." checked={draft.site.maintenanceMode} disabled={!canEditSite} onChange={(v) => setSite("maintenanceMode", v)} />
              </div>
            </div>
          )}

          {profile && tab === "profile" && (
            <ProfileTab profile={profile} set={setProfileField} onPickAvatar={() => setAvatarPicker(true)} onError={setError} onNotice={setNotice} />
          )}

          {draft && tab === "appearance" && (
            <div className="space-y-5">
              <SectionHead title="Appearance" sub="Theme, fonts and layout of your public site." />
              <Field label="Theme">
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    { v: "light", t: "Light", d: "Default bright theme." },
                    { v: "dark", t: "Dark", d: "Dark background site-wide." },
                    { v: "auto", t: "Auto", d: "Follows the reader's system." },
                  ] as const).map((o) => {
                    const active = draft.appearance.theme === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        disabled={!canEditSite}
                        onClick={() => setAppearance("theme", o.v as ThemeMode)}
                        className={`rounded-lg border p-3 text-left transition disabled:opacity-60 ${active ? "border-brand bg-brand-soft/50 ring-1 ring-brand" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">{o.t}</span>
                          {active && <Check width={15} height={15} className="text-brand" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{o.d}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Accent colour" hint="Used for links, buttons and highlights.">
                <div className="flex flex-wrap items-center gap-2.5">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!canEditSite}
                      aria-label={c}
                      onClick={() => setAppearance("accentColor", c)}
                      className={`h-7 w-7 rounded-full transition disabled:opacity-60 ${draft.appearance.accentColor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    value={draft.appearance.accentColor}
                    disabled={!canEditSite}
                    onChange={(e) => setAppearance("accentColor", e.target.value)}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm uppercase text-slate-700 outline-none focus:border-brand disabled:bg-slate-50"
                  />
                </div>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Heading font">
                  <Select value={draft.appearance.headingFont} disabled={!canEditSite} onChange={(v) => setAppearance("headingFont", v)}>
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </Field>
                <Field label="Body font">
                  <Select value={draft.appearance.bodyFont} disabled={!canEditSite} onChange={(v) => setAppearance("bodyFont", v)}>
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Content width">
                <Select value={draft.appearance.contentWidth} disabled={!canEditSite} onChange={(v) => setAppearance("contentWidth", v as Settings["appearance"]["contentWidth"])}>
                  <option value="narrow">Narrow — 720px</option>
                  <option value="standard">Standard — 880px</option>
                  <option value="wide">Wide — 1080px</option>
                </Select>
              </Field>
              <div className="pt-1">
                <ToggleRow label="Show cover images in post lists" checked={draft.appearance.showCoverImages} disabled={!canEditSite} onChange={(v) => setAppearance("showCoverImages", v)} />
                <ToggleRow label="Sticky navigation bar" checked={draft.appearance.stickyNav} disabled={!canEditSite} onChange={(v) => setAppearance("stickyNav", v)} />
              </div>
            </div>
          )}

          {draft && tab === "reading" && (
            <div className="space-y-5">
              <SectionHead title="Reading" sub="How posts appear in feeds and archives." />
              <Field label="Post lists show" hint="Full text can slow down long archive pages.">
                <Select value={draft.reading.postListsShow} disabled={!canEditSite} onChange={(v) => setReading("postListsShow", v as Settings["reading"]["postListsShow"])}>
                  <option value="excerpt">Excerpt only</option>
                  <option value="full">Full text</option>
                </Select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Excerpt length (words)">
                  <input type="number" min={10} max={300} value={draft.reading.excerptWords} disabled={!canEditSite} onChange={(e) => setReading("excerptWords", Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Items in RSS feed">
                  <input type="number" min={1} max={100} value={draft.reading.rssItems} disabled={!canEditSite} onChange={(e) => setReading("rssItems", Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <div className="pt-1">
                <ToggleRow label="Show estimated reading time" checked={draft.reading.showReadingTime} disabled={!canEditSite} onChange={(v) => setReading("showReadingTime", v)} />
                <ToggleRow label="Show author bio under posts" checked={draft.reading.showAuthorBio} disabled={!canEditSite} onChange={(v) => setReading("showAuthorBio", v)} />
                <ToggleRow label="Show related posts" checked={draft.reading.showRelatedPosts} disabled={!canEditSite} onChange={(v) => setReading("showRelatedPosts", v)} />
              </div>
            </div>
          )}

          {draft && tab === "comments" && (
            <div className="space-y-5">
              <SectionHead title="Comments" sub="Who can comment and how they're moderated." />
              <Field label="Who can comment">
                <Select value={draft.comments.whoCanComment} disabled={!canEditSite} onChange={(v) => setComments("whoCanComment", v as Settings["comments"]["whoCanComment"])}>
                  <option value="anyone">Anyone with a name &amp; email</option>
                  <option value="subscribers">Confirmed subscribers only</option>
                  <option value="closed">Comments closed</option>
                </Select>
              </Field>
              <Field label="Comment nesting depth" hint="How deep replies can be threaded.">
                <Select value={draft.comments.nestingDepth} disabled={!canEditSite} onChange={(v) => setComments("nestingDepth", Number(v))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} level{n > 1 ? "s" : ""}</option>)}
                </Select>
              </Field>
              <div className="pt-1">
                <ToggleRow label="Hold new comments for moderation" hint="New comments stay pending until an editor approves them." checked={draft.comments.holdForModeration} disabled={!canEditSite} onChange={(v) => setComments("holdForModeration", v)} />
                <ToggleRow label="Automatically close comments after 60 days" checked={draft.comments.autoCloseComments} disabled={!canEditSite} onChange={(v) => setComments("autoCloseComments", v)} />
                <ToggleRow label="Email me on every new comment" checked={draft.comments.emailOnNewComment} disabled={!canEditSite} onChange={(v) => setComments("emailOnNewComment", v)} />
                <ToggleRow label="Require spam check (reCAPTCHA)" checked={draft.comments.requireRecaptcha} disabled={!canEditSite} onChange={(v) => setComments("requireRecaptcha", v)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaPickerModal open={logoPicker} onClose={() => setLogoPicker(false)} onSelect={(url) => setSite("logoUrl", url)} />
      <MediaPickerModal open={avatarPicker} onClose={() => setAvatarPicker(false)} onSelect={(url) => setProfileField("avatar", url)} />
    </div>
  );
}

/* --------------------------------- profile tab -------------------------------- */

function ProfileTab({
  profile,
  set,
  onPickAvatar,
  onError,
  onNotice,
}: {
  profile: Me;
  set: <K extends keyof Me>(key: K, value: Me[K]) => void;
  onPickAvatar: () => void;
  onError: (m: string | null) => void;
  onNotice: (m: string | null) => void;
}) {
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function submitPassword() {
    setPwError(null);
    if (next.length < 8) return setPwError("New password must be at least 8 characters.");
    if (next !== confirm) return setPwError("New passwords do not match.");
    setPwBusy(true);
    try {
      await changePassword(current, next);
      setPwOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
      onError(null);
      onNotice("Your password has been changed.");
    } catch (e) {
      setPwError((e as Error).message || "Couldn't change your password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHead title="Profile information" sub="Your personal account details and sign-in." />

      <div className="flex items-center gap-4">
        <Avatar name={profile.name || profile.email} src={profile.avatar} size={56} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPickAvatar} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Camera width={15} height={15} /> Change photo
          </button>
          {profile.avatar && (
            <button type="button" onClick={() => set("avatar", "")} className="text-sm font-medium text-rose-600 hover:text-rose-700">Remove</button>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name">
          <input value={profile.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Last name">
          <input value={profile.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Email address">
        <div className="relative">
          <Mail width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={profile.email} onChange={(e) => set("email", e.target.value)} className={`${inputCls} pl-9`} />
        </div>
      </Field>
      <Field label="Display name" hint="Shown as the author byline on your posts.">
        <input value={profile.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Bio">
        <textarea value={profile.bio} onChange={(e) => set("bio", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </Field>

      {/* password */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        {!pwOpen ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500"><Lock width={15} height={15} /></span>
              <div>
                <p className="text-sm font-medium text-slate-700">Password</p>
                <p className="text-xs text-slate-400">Change your sign-in password.</p>
              </div>
            </div>
            <button type="button" onClick={() => setPwOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Change password
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pwError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pwError}</div>}
            <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setPwOpen(false); setPwError(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={submitPassword} disabled={pwBusy} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                {pwBusy ? "Saving…" : "Update password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- theme apply -------------------------------- */

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = mode === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem("brandish-theme", mode);
  } catch {
    /* ignore */
  }
}
