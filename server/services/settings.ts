import { AppError } from '../lib/errors';
import { getDb } from '../lib/mongodb';

// ⚠ Native-driver module — `settings` is a native-driver-only collection (see the ODM split in
// docs/data-model.md). One singleton document (`_id: 'site'`) holds the whole site's config.
// Holds behaviour/presentation only — NEVER secrets (those stay in SSM). See the Settings &
// theme flow in docs/workflows.md.

const COLLECTION = 'settings';
const SITE_ID = 'site';
const CACHE_TTL_MS = 60_000;

export type PostListsShow = 'excerpt' | 'full';
export type WhoCanComment = 'anyone' | 'subscribers' | 'closed';

export interface SiteSettings {
  title: string;
  logoUrl: string;
  tagline: string;
  description: string;
  language: string;
  timezone: string;
  postsPerPage: number;
  showAuthorBylines: boolean;
  enableComments: boolean;
  enableRss: boolean;
  maintenanceMode: boolean;
}
export interface SocialsSettings {
  facebook: string;
  x: string;
  linkedin: string;
  instagram: string;
  whatsapp: string; // phone number (e.g. +234…), not a URL
  youtube: string;
}
export interface ReadingSettings {
  postListsShow: PostListsShow;
  excerptWords: number;
  rssItems: number;
  showReadingTime: boolean;
  showAuthorBio: boolean;
  showRelatedPosts: boolean;
}
export interface CommentSettings {
  whoCanComment: WhoCanComment;
  nestingDepth: number;
  holdForModeration: boolean;
  autoCloseComments: boolean;
  emailOnNewComment: boolean;
  requireRecaptcha: boolean;
}
export interface Settings {
  site: SiteSettings;
  socials: SocialsSettings;
  reading: ReadingSettings;
  comments: CommentSettings;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  site: {
    title: 'Brandish',
    logoUrl: '',
    tagline: '',
    description: '',
    language: 'en-US',
    timezone: 'Africa/Lagos',
    postsPerPage: 12,
    showAuthorBylines: true,
    enableComments: true,
    enableRss: true,
    maintenanceMode: false,
  },
  socials: {
    facebook: '',
    x: '',
    linkedin: '',
    instagram: '',
    whatsapp: '',
    youtube: '',
  },
  reading: {
    postListsShow: 'excerpt',
    excerptWords: 55,
    rssItems: 20,
    showReadingTime: true,
    showAuthorBio: true,
    showRelatedPosts: false,
  },
  comments: {
    whoCanComment: 'anyone',
    nestingDepth: 3,
    holdForModeration: true,
    autoCloseComments: false,
    emailOnNewComment: true,
    requireRecaptcha: true,
  },
  updatedAt: null,
  updatedBy: null,
};

const LIST_SHOW: PostListsShow[] = ['excerpt', 'full'];
const WHO: WhoCanComment[] = ['anyone', 'subscribers', 'closed'];

// ---- coercers (never trust the client; clamp/validate every field) ----
const str = (v: unknown, def: string) => (typeof v === 'string' ? v : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? Math.floor(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const oneOf = <T,>(v: unknown, allowed: readonly T[], def: T) => (allowed.includes(v as T) ? (v as T) : def);
// A social profile URL: empty string clears the field; otherwise it must be a valid http(s)
// URL (≤300 chars) or the current value is kept. Never stores javascript:/data: or garbage.
const url = (v: unknown, def: string) => {
  if (typeof v !== 'string') return def;
  const t = v.trim();
  if (t === '') return '';
  try {
    const parsed = new URL(t);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return t.slice(0, 300);
  } catch {
    /* not a parseable URL */
  }
  return def;
};
// A WhatsApp phone number: '+', digits, spaces, hyphens and parens only, with ≥7 digits.
// Empty string clears the field; anything malformed keeps the current value.
const phone = (v: unknown, def: string) => {
  if (typeof v !== 'string') return def;
  const t = v.trim();
  if (t === '') return '';
  if (/^\+?[\d\s()-]+$/.test(t) && t.replace(/\D/g, '').length >= 7) return t.slice(0, 32);
  return def;
};

function mergeSite(cur: SiteSettings, p: Partial<Record<keyof SiteSettings, unknown>> = {}): SiteSettings {
  return {
    title: str(p.title, cur.title).slice(0, 120) || cur.title,
    logoUrl: str(p.logoUrl, cur.logoUrl),
    tagline: str(p.tagline, cur.tagline).slice(0, 200),
    description: str(p.description, cur.description).slice(0, 500),
    language: str(p.language, cur.language),
    timezone: str(p.timezone, cur.timezone),
    postsPerPage: int(p.postsPerPage, cur.postsPerPage, 1, 100),
    showAuthorBylines: bool(p.showAuthorBylines, cur.showAuthorBylines),
    enableComments: bool(p.enableComments, cur.enableComments),
    enableRss: bool(p.enableRss, cur.enableRss),
    maintenanceMode: bool(p.maintenanceMode, cur.maintenanceMode),
  };
}
function mergeSocials(cur: SocialsSettings, p: Partial<Record<keyof SocialsSettings, unknown>> = {}): SocialsSettings {
  return {
    facebook: url(p.facebook, cur.facebook),
    x: url(p.x, cur.x),
    linkedin: url(p.linkedin, cur.linkedin),
    instagram: url(p.instagram, cur.instagram),
    whatsapp: phone(p.whatsapp, cur.whatsapp),
    youtube: url(p.youtube, cur.youtube),
  };
}
function mergeReading(cur: ReadingSettings, p: Partial<Record<keyof ReadingSettings, unknown>> = {}): ReadingSettings {
  return {
    postListsShow: oneOf(p.postListsShow, LIST_SHOW, cur.postListsShow),
    excerptWords: int(p.excerptWords, cur.excerptWords, 10, 300),
    rssItems: int(p.rssItems, cur.rssItems, 1, 100),
    showReadingTime: bool(p.showReadingTime, cur.showReadingTime),
    showAuthorBio: bool(p.showAuthorBio, cur.showAuthorBio),
    showRelatedPosts: bool(p.showRelatedPosts, cur.showRelatedPosts),
  };
}
function mergeComments(cur: CommentSettings, p: Partial<Record<keyof CommentSettings, unknown>> = {}): CommentSettings {
  return {
    whoCanComment: oneOf(p.whoCanComment, WHO, cur.whoCanComment),
    nestingDepth: int(p.nestingDepth, cur.nestingDepth, 1, 10),
    holdForModeration: bool(p.holdForModeration, cur.holdForModeration),
    autoCloseComments: bool(p.autoCloseComments, cur.autoCloseComments),
    emailOnNewComment: bool(p.emailOnNewComment, cur.emailOnNewComment),
    requireRecaptcha: bool(p.requireRecaptcha, cur.requireRecaptcha),
  };
}

/** Merge a stored (possibly partial/legacy) document over DEFAULT_SETTINGS — additive-safe. */
function withDefaults(stored: Record<string, any>): Settings {
  return {
    site: mergeSite(DEFAULT_SETTINGS.site, stored.site ?? {}),
    socials: mergeSocials(DEFAULT_SETTINGS.socials, stored.socials ?? {}),
    reading: mergeReading(DEFAULT_SETTINGS.reading, stored.reading ?? {}),
    comments: mergeComments(DEFAULT_SETTINGS.comments, stored.comments ?? {}),
    updatedAt: stored.updatedAt ?? null,
    updatedBy: stored.updatedBy ?? null,
  };
}

let cache: { value: Settings; at: number } | null = null;

function collection() {
  return getDb().then((db) => db.collection(COLLECTION));
}

/** Cached read of the singleton, defaults merged in. Cache is busted on write + expires by TTL. */
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const col = await collection();
  const doc = (await col.findOne({ _id: SITE_ID as any })) as Record<string, any> | null;
  const value = withDefaults(doc ?? {});
  cache = { value, at: Date.now() };
  return value;
}

/** Public-safe subset — everything here is non-secret presentation/behaviour config. */
export function toPublic(s: Settings) {
  return {
    site: {
      title: s.site.title,
      logoUrl: s.site.logoUrl,
      tagline: s.site.tagline,
      description: s.site.description,
      language: s.site.language,
      timezone: s.site.timezone,
      postsPerPage: s.site.postsPerPage,
      showAuthorBylines: s.site.showAuthorBylines,
      enableComments: s.site.enableComments,
      enableRss: s.site.enableRss,
      maintenanceMode: s.site.maintenanceMode,
    },
    socials: s.socials,
    reading: s.reading,
    comments: { whoCanComment: s.comments.whoCanComment, nestingDepth: s.comments.nestingDepth },
  };
}

export async function getPublicSettings() {
  return toPublic(await getSettings());
}

/** Deep-merge a partial patch (one or more sections) over the current settings, coerced + saved. */
export async function updateSettings(patch: Record<string, any>, userId: string): Promise<Settings> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new AppError(400, 'INVALID_SETTINGS', 'A settings object is required');
  }
  const cur = await getSettings();
  const next: Settings = {
    site: patch.site ? mergeSite(cur.site, patch.site) : cur.site,
    socials: patch.socials ? mergeSocials(cur.socials, patch.socials) : cur.socials,
    reading: patch.reading ? mergeReading(cur.reading, patch.reading) : cur.reading,
    comments: patch.comments ? mergeComments(cur.comments, patch.comments) : cur.comments,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  const col = await collection();
  // On upsert-insert Mongo takes _id from the filter; never $set _id (it's immutable on update).
  await col.updateOne({ _id: SITE_ID as any }, { $set: next as any }, { upsert: true });
  cache = null; // bust so the next read is fresh across this warm container
  return next;
}

/** Test seam — drop the in-process cache. */
export function _clearCache() {
  cache = null;
}
