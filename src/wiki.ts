/**
 * Client for the community GTA Wiki (gta.fandom.com, MediaWiki API).
 * Content is CC BY-SA; every result carries its source URL.
 */

export const WIKI_BASE = "https://gta.fandom.com";
const API = `${WIKI_BASE}/api.php`;
const UA = "gta6-mcp/1.0 (+https://github.com/adnan-kutay-yuksel/gta6-mcp)";

/** Small in-memory cache so repeated questions don't hammer the wiki. */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 30 * 60 * 1000;

export type Fetcher = (url: string) => Promise<unknown>;

let fetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`GTA Wiki returned HTTP ${res.status}`);
  return res.json();
};

/** For tests: replace the network layer. */
export function setFetcher(f: Fetcher) {
  fetcher = f;
  cache.clear();
}

async function api(params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${API}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = (await fetcher(url)) as any;
  if (data?.error) throw new Error(`GTA Wiki: ${data.error.info ?? data.error.code}`);
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return data;
}

export function pageUrl(title: string): string {
  return `${WIKI_BASE}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Title/snippet hints. Case-sensitive on purpose: "GTA Vice City" must not match "GTA VI". */
const GTA6_HINT = /\b(GTA VI|GTA 6|Grand Theft Auto VI|Leonida|Lucia Caminos|Jason Duval)\b/;
/** A category that belongs to GTA VI (e.g. "Category:Vehicles in GTA VI", "Locations in GTA VI in Ambrosia"). */
export const GTA6_CATEGORY = /\bGTA VI\b|\bGrand Theft Auto VI\b/;

/** Which of these titles are in a GTA VI category (one batched request). */
export async function gta6Titles(titles: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!titles.length) return out;
  const c = await api({ action: "query", titles: titles.slice(0, 50).join("|"), prop: "categories", cllimit: "max", redirects: 1 });
  const redirects = (c?.query?.redirects ?? []) as { from: string; to: string }[];
  for (const p of (c?.query?.pages ?? []) as { title: string; categories?: { title: string }[] }[]) {
    if ((p.categories ?? []).some((x) => GTA6_CATEGORY.test(x.title))) {
      out.add(p.title);
      for (const r of redirects) if (r.to === p.title) out.add(r.from);
    }
  }
  return out;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  gta6: boolean;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").trim();
}

/** Full-text search, biased to GTA VI content; hits are flagged when they are about GTA VI. */
export async function search(query: string, limit = 10): Promise<SearchHit[]> {
  const scoped = /\b(gta ?(vi|6)|grand theft auto vi)\b/i.test(query) ? query : `${query} "GTA VI"`;
  const [a, b] = await Promise.all([
    api({ action: "query", list: "search", srsearch: scoped, srlimit: limit, srprop: "snippet" }),
    api({ action: "query", list: "search", srsearch: query, srlimit: limit, srprop: "snippet" }),
  ]);
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const h of [...(a?.query?.search ?? []), ...(b?.query?.search ?? [])] as { title: string; snippet: string }[]) {
    if (seen.has(h.title)) continue;
    seen.add(h.title);
    const snippet = stripHtml(h.snippet ?? "");
    hits.push({ title: h.title, url: pageUrl(h.title), snippet, gta6: GTA6_HINT.test(h.title) || GTA6_HINT.test(snippet) });
  }
  // a hit is about GTA VI if it sits in a GTA VI category (or is a GTA VI category/list itself)
  try {
    const six = await gta6Titles(hits.map((h) => h.title));
    for (const h of hits) h.gta6 = six.has(h.title) || GTA6_CATEGORY.test(h.title) || (h.gta6 && !/\bGTA (V|IV|III|San Andreas|Vice City)\b/.test(h.title));
  } catch { /* best effort: keep title hints */ }
  hits.sort((x, y) => Number(y.gta6) - Number(x.gta6));
  return hits.slice(0, limit);
}

export interface PageResult {
  title: string;
  url: string;
  categories: string[];
  sections: { index: number; title: string; level: number }[];
  section?: string;
  text: string;
  truncated: boolean;
  infobox?: Record<string, string>;
  coversGta6: boolean;
  spoilerRisk: "high" | "medium" | "low";
  spoilerSections: string[];
  textWithheld?: string;
  safeSections?: string[];
  license: string;
}

/** Convert wikitext to readable plain text. */
export function wikitextToPlain(w: string): string {
  let s = w;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "");
  s = s.replace(/<gallery[\s\S]*?<\/gallery>/gi, "");
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/\{\{(?:[Ss]ic|[Ii]tem|[Cc]olor|[Tt]ooltip|[Ii]con)\|([^{}|]*)(?:\|[^{}]*)?\}\}/g, "$1");
    s = s.replace(/\{\{[^{}]*\}\}/g, "");
    if (s === before) break;
  }
  s = s.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "");
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1").replace(/\[\[([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[https?:\/\/\S+ ([^\]]*)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "");
  s = s.replace(/'''?/g, "");
  s = s.replace(/^\{\|.*$/gm, "").replace(/^\|\}.*$/gm, "").replace(/^\|-.*$/gm, "").replace(/^!\s*/gm, "").replace(/^\|\s*/gm, "");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  s = s.replace(/__\w+__/g, "");
  s = s.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Extract `| key = value` pairs from the first infobox template. */
export function parseInfobox(w: string): Record<string, string> | undefined {
  const start = w.search(/\{\{\s*(Infobox|[A-Za-z ]*infobox)/i);
  if (start < 0) return undefined;
  let depth = 0, end = start;
  for (let i = start; i < w.length - 1; i++) {
    if (w[i] === "{" && w[i + 1] === "{") { depth++; i++; }
    else if (w[i] === "}" && w[i + 1] === "}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const body = w.slice(start, end);
  const out: Record<string, string> = {};
  // split on top-level pipes only
  let d = 0, sq = 0, cur = "";
  const parts: string[] = [];
  for (let i = 2; i < body.length - 2; i++) {
    const c = body[i], n = body[i + 1];
    if (c === "{" && n === "{") { d++; cur += "{{"; i++; continue; }
    if (c === "}" && n === "}") { d--; cur += "}}"; i++; continue; }
    if (c === "[" && n === "[") { sq++; cur += "[["; i++; continue; }
    if (c === "]" && n === "]") { sq--; cur += "]]"; i++; continue; }
    if (c === "|" && d === 0 && sq === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    const v = wikitextToPlain(p.slice(eq + 1)).replace(/\n+/g, "; ").trim();
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const SPOILER_SECTION = /events of|ending|death|fate|plot|story|walkthrough|mission appearances|betrayal|aftermath/i;

function spoilerRisk(title: string, categories: string[], text: string, sections: { title: string }[]): PageResult["spoilerRisk"] {
  const cats = categories.join(" ").toLowerCase();
  if (/missions|story|endings|deaths|deceased|antagonists/.test(cats) || /\{\{spoiler/i.test(text)) return "high";
  if (sections.some((s) => /ending|death|fate/i.test(s.title))) return "high";
  if (/characters/.test(cats)) return "medium";
  return "low";
}

/** Resolve a user-friendly title to the GTA VI-specific page when one exists. */
export async function resolveTitle(title: string): Promise<string> {
  const candidates = [`${title} (GTA VI)`, `${title} (Grand Theft Auto VI)`, `${title} (HD Universe)`, title];
  const d = await api({ action: "query", titles: candidates.join("|"), redirects: 1 });
  const pages = (d?.query?.pages ?? []) as { title: string; missing?: boolean }[];
  const redirects = (d?.query?.redirects ?? []) as { from: string; to: string }[];
  const normalized = (d?.query?.normalized ?? []) as { from: string; to: string }[];
  const resolve = (t: string) => {
    const n = normalized.find((x) => x.from === t)?.to ?? t;
    return redirects.find((x) => x.from === n)?.to ?? n;
  };
  const existing = [...new Set(candidates.map(resolve).filter((t) => pages.some((x) => x.title === t && !x.missing)))];
  let six = new Set<string>();
  try { six = await gta6Titles(existing); } catch { /* ignore */ }
  const gta6Existing = existing.find((t) => six.has(t));
  if (gta6Existing) return gta6Existing;
  // e.g. "Cheetah" → "'95 Grotti Cheetah": prefer a GTA VI search hit whose title contains the query
  const hits = await search(title, 8);
  const words = title.toLowerCase().split(/\s+/).filter(Boolean);
  const gta6Hit = hits.find((h) => h.gta6 && words.every((w) => h.title.toLowerCase().includes(w)));
  if (gta6Hit) return gta6Hit.title;
  if (existing.length) return existing[0];
  if (hits.length) return hits[0].title;
  throw new Error(`No GTA Wiki page found for "${title}".`);
}

export async function getPage(title: string, opts: { section?: string; maxChars?: number; spoilers?: boolean } = {}): Promise<PageResult> {
  const maxChars = opts.maxChars ?? 10000;
  const real = await resolveTitle(title);
  const meta = await api({ action: "parse", page: real, prop: "sections|categories|wikitext", redirects: 1 });
  const p = meta.parse;
  const sections = ((p.sections ?? []) as { index: string; line: string; level: string }[]).map((s) => ({ index: Number(s.index), title: stripHtml(s.line), level: Number(s.level) }));
  const categories = ((p.categories ?? []) as { category: string; hidden?: boolean }[]).filter((c) => !c.hidden).map((c) => c.category.replace(/_/g, " "));
  let wikitext: string = p.wikitext ?? "";
  let sectionTitle: string | undefined;
  if (opts.section) {
    const want = opts.section.toLowerCase();
    const s = sections.find((x) => x.title.toLowerCase() === want) ?? sections.find((x) => x.title.toLowerCase().includes(want)) ?? sections.find((x) => String(x.index) === want);
    if (!s) throw new Error(`Section "${opts.section}" not found. Available: ${sections.map((x) => x.title).join(", ")}`);
    const sec = await api({ action: "parse", page: p.title, prop: "wikitext", section: s.index });
    wikitext = sec.parse.wikitext ?? "";
    sectionTitle = s.title;
  }
  const risk = spoilerRisk(p.title, categories, p.wikitext ?? "", sections);
  const spoilerSections = sections.filter((x) => SPOILER_SECTION.test(x.title)).map((x) => x.title);
  const safeSections = sections.filter((x) => !SPOILER_SECTION.test(x.title) && !/gallery|screenshots|navigation|references|see also/i.test(x.title)).map((x) => x.title);
  let text = wikitextToPlain(wikitext);
  let textWithheld: string | undefined;
  if (!opts.spoilers) {
    if (sectionTitle && SPOILER_SECTION.test(sectionTitle)) {
      textWithheld = `Section "${sectionTitle}" contains story spoilers. Ask the player first, then call again with spoilers=true.`;
    } else if (!sectionTitle && risk !== "low") {
      textWithheld = `This ${risk === "high" ? "page has story spoilers" : "page may reveal story details"}. Read a safe section instead (${safeSections.join(", ") || "none"}) or, if the player agrees to spoilers, call again with spoilers=true.`;
    }
    if (textWithheld) text = "";
  }
  return {
    title: p.title,
    url: pageUrl(p.title) + (sectionTitle ? `#${encodeURIComponent(sectionTitle.replace(/ /g, "_"))}` : ""),
    categories,
    sections,
    section: sectionTitle,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    infobox: opts.section ? undefined : parseInfobox(p.wikitext ?? ""),
    coversGta6: categories.some((c) => GTA6_CATEGORY.test(c)) || GTA6_CATEGORY.test(p.title),
    spoilerRisk: risk,
    spoilerSections,
    ...(textWithheld ? { textWithheld, safeSections } : {}),
    license: "Text from the GTA Wiki (gta.fandom.com), CC BY-SA 3.0.",
  };
}

export interface ListResult {
  category: string;
  url: string;
  pages: string[];
  subcategories: string[];
  next?: string;
}

/** List members of a wiki category ("Vehicles in GTA VI" etc.). */
export async function listCategory(category: string, limit = 100, cont?: string): Promise<ListResult> {
  const name = category.replace(/^Category:/i, "");
  const d = await api({
    action: "query", list: "categorymembers", cmtitle: `Category:${name}`, cmlimit: Math.min(limit, 500),
    ...(cont ? { cmcontinue: cont } : {}),
  });
  const members = (d?.query?.categorymembers ?? []) as { title: string; ns: number }[];
  return {
    category: name,
    url: pageUrl(`Category:${name}`),
    pages: members.filter((m) => m.ns !== 14).map((m) => m.title),
    subcategories: members.filter((m) => m.ns === 14).map((m) => m.title.replace(/^Category:/, "")),
    next: d?.continue?.cmcontinue,
  };
}

/** Find GTA VI categories matching a topic (e.g. "radio" → "Radio Stations in GTA VI"). */
export async function findCategories(topic: string, limit = 10): Promise<string[]> {
  const d = await api({ action: "query", list: "search", srsearch: `${topic} GTA VI`, srnamespace: 14, srlimit: limit * 2 });
  return ((d?.query?.search ?? []) as { title: string }[])
    .map((h) => h.title.replace(/^Category:/, ""))
    .filter((t) => GTA6_CATEGORY.test(t))
    .slice(0, limit);
}
