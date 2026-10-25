import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/**
 * Optional news integration: The Guardian Open Platform (free developer key).
 * We store the headline, standfirst, date, link and a text excerpt used only
 * to build learning activities. Nothing is invented: if the API isn't
 * configured or fails, the UI says so and offers prepared activities instead.
 */

export const NEWS_SECTIONS = [
  { id: "world", label: "World" },
  { id: "business", label: "Business" },
  { id: "travel", label: "Travel" },
  { id: "culture", label: "Culture" },
  { id: "technology", label: "Technology" },
  { id: "environment", label: "Environment" },
  { id: "lifeandstyle", label: "Life & style" },
] as const;

export function newsConfigured() {
  return !!process.env.GUARDIAN_API_KEY?.trim();
}

export interface NewsItem {
  externalId: string;
  title: string;
  url: string;
  publishedAt: string;
  standfirst: string;
  excerpt: string;
  section: string;
}

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a Guardian /search response. Exported for tests. */
export function parseGuardian(json: unknown): NewsItem[] {
  const results = (json as { response?: { results?: unknown[] } })?.response?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r) => r as { id?: string; webTitle?: string; webUrl?: string; webPublicationDate?: string; sectionName?: string; fields?: { trailText?: string; bodyText?: string } })
    .filter((r) => r.id && r.webTitle && r.webUrl && r.webPublicationDate && /^https:\/\//.test(r.webUrl))
    .map((r) => ({
      externalId: r.id!,
      title: stripHtml(r.webTitle!),
      url: r.webUrl!,
      publishedAt: r.webPublicationDate!,
      standfirst: stripHtml(r.fields?.trailText ?? ""),
      // Only an excerpt is kept, for generating questions; the learner reads the full article at the source.
      excerpt: stripHtml(r.fields?.bodyText ?? "").split(" ").slice(0, 450).join(" "),
      section: r.sectionName ?? "",
    }));
}

const CACHE_MINUTES = 60;

export async function latestNews(section: string): Promise<{ items: Array<typeof schema.contentResources.$inferSelect>; error?: string; cached: boolean }> {
  const db = getDb();
  const tag = `news:${section}`;
  const cached = await db
    .select()
    .from(schema.contentResources)
    .where(and(eq(schema.contentResources.kind, tag), gte(schema.contentResources.createdAt, new Date(Date.now() - CACHE_MINUTES * 60000))))
    .orderBy(desc(schema.contentResources.publishedAt))
    .all();
  if (cached.length) return { items: cached, cached: true };
  if (!newsConfigured()) return { items: [], cached: false, error: "not-configured" };

  const params = new URLSearchParams({
    section,
    "order-by": "newest",
    "page-size": "8",
    "show-fields": "trailText,bodyText",
    "api-key": process.env.GUARDIAN_API_KEY!.trim(),
  });
  try {
    const res = await fetch(`https://content.guardianapis.com/search?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { items: await olderCache(tag), cached: true, error: res.status === 401 || res.status === 403 ? "The Guardian API rejected the key." : `The news service returned an error (${res.status}).` };
    const items = parseGuardian(await res.json());
    for (const it of items) {
      const exists = await db.select().from(schema.contentResources).where(eq(schema.contentResources.externalId, it.externalId)).get();
      if (exists) await db.update(schema.contentResources).set({ createdAt: new Date(), kind: tag }).where(eq(schema.contentResources.id, exists.id)).run();
      else
        await db
          .insert(schema.contentResources)
          .values({ kind: tag, title: it.title, url: it.url, sourceName: "The Guardian", publishedAt: it.publishedAt, summary: it.standfirst, sourceText: it.excerpt, externalId: it.externalId })
          .run();
    }
    return { items: await db.select().from(schema.contentResources).where(eq(schema.contentResources.kind, tag)).orderBy(desc(schema.contentResources.publishedAt)).limit(8).all(), cached: false };
  } catch {
    return { items: await olderCache(tag), cached: true, error: "The news service couldn't be reached. Showing previously loaded articles, if any." };
  }
}

async function olderCache(tag: string) {
  return getDb().select().from(schema.contentResources).where(eq(schema.contentResources.kind, tag)).orderBy(desc(schema.contentResources.publishedAt)).limit(8).all();
}
