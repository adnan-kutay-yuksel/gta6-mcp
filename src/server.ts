import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FACTS, FACTS_AS_OF } from "./facts.js";
import { platformReport } from "./platform.js";
import { findCategories, getPage, listCategory, search, WIKI_BASE } from "./wiki.js";

export const VERSION = "1.0.0";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
const fail = (e: unknown): ToolResult => ({ content: [{ type: "text", text: `Error: ${(e as Error).message ?? String(e)}` }], isError: true });
async function guard(fn: () => Promise<unknown> | unknown): Promise<ToolResult> {
  try { return ok(await fn()); } catch (e) { return fail(e); }
}

/** Common topics → GTA Wiki category names. */
export const TOPICS: Record<string, string> = {
  missions: "Missions in GTA VI",
  vehicles: "Vehicles in GTA VI",
  characters: "Characters in GTA VI",
  weapons: "Weapons in GTA VI",
  locations: "Locations in GTA VI",
};

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "gta6-mcp", version: VERSION },
    {
      instructions:
        "Knowledge tools for Grand Theft Auto VI (released 2026-11-19 on PS5 and Xbox Series X|S). Game facts come live from the " +
        "community GTA Wiki (cite the returned URL) plus a small set of official facts. Console saves are not readable, so ask the " +
        "player where they are in the story when it matters. Spoilers: results carry a spoilerRisk; unless the player asked for " +
        "spoilers, do not reveal story events, deaths, twists or endings beyond what they say they've reached. Use the player's " +
        "controller vocabulary from gta6_platform. If the wiki has no answer, say so instead of guessing.",
    },
  );

  server.registerTool("gta6_overview", {
    title: "GTA VI overview",
    description: "Official facts (release, platforms, PC status, setting, protagonists, timeline, sources) plus the live summary from the GTA Wiki.",
    inputSchema: {},
  }, async () => guard(async () => {
    let live: unknown;
    try {
      const p = await getPage("Grand Theft Auto VI", { maxChars: 2500, spoilers: true });
      live = { summary: p.text.split("\n\n").slice(0, 3).join("\n\n"), url: p.url, sections: p.sections.map((s) => s.title) };
    } catch (e) {
      live = { error: `Live wiki unavailable: ${(e as Error).message}` };
    }
    return { factsAsOf: FACTS_AS_OF, ...FACTS, liveFromWiki: live };
  }));

  server.registerTool("gta6_platform", {
    title: "Platform & controller info",
    description: "What the player's computer can/can't do for GTA VI (no PC/Mac version yet), PC release status, and controller button vocabulary for their console.",
    inputSchema: { console: z.enum(["ps5", "ps5-pro", "xbox-series-x", "xbox-series-s"]).optional().describe("Player's console, if known.") },
  }, async ({ console: c }) => guard(() => platformReport(c)));

  server.registerTool("gta6_search", {
    title: "Search the GTA Wiki",
    description: "Full-text search of the GTA Wiki, prioritising GTA VI pages (each hit has gta6=true/false and a URL).",
    inputSchema: { query: z.string(), limit: z.number().int().min(1).max(25).default(10) },
  }, async ({ query, limit }) => guard(() => search(query, limit)));

  server.registerTool("gta6_page", {
    title: "Read a GTA Wiki page",
    description: "Read a page (automatically prefers the GTA VI version, e.g. 'Lucia' → the GTA VI article). Returns infobox, sections, categories, spoilerRisk and plain text; story-heavy text is withheld unless spoilers=true. Use `section` to read one section (e.g. 'Walkthrough', 'Locations', 'Trivia').",
    inputSchema: {
      title: z.string(),
      section: z.string().optional(),
      maxChars: z.number().int().min(200).max(40000).default(10000),
      spoilers: z.boolean().default(false).describe("Only set true after the player agreed to story spoilers. When false, spoiler-heavy pages/sections are withheld and safe sections are suggested."),
    },
  }, async ({ title, section, maxChars, spoilers }) => guard(() => getPage(title, { section, maxChars, spoilers })));

  server.registerTool("gta6_list", {
    title: "List GTA VI things",
    description: `List wiki pages in a GTA VI category. Topics: ${Object.keys(TOPICS).join(", ")}, or any other topic (e.g. "radio stations", "businesses", "animals") which is matched to a GTA VI category.`,
    inputSchema: {
      topic: z.string().describe("A topic like 'vehicles' or an exact category name like 'Locations in GTA VI in Ambrosia'."),
      limit: z.number().int().min(1).max(500).default(100),
      cursor: z.string().optional().describe("`next` value from a previous call to continue the list."),
    },
  }, async ({ topic, limit, cursor }) => guard(async () => {
    const key = topic.toLowerCase().trim();
    const mapped = TOPICS[key] ?? TOPICS[key.replace(/s?$/, "s")];
    // 1) known topic or an explicit GTA VI category name
    if (mapped || /GTA VI/i.test(topic)) {
      const res = await listCategory(mapped ?? topic, limit, cursor);
      if (res.pages.length || res.subcategories.length) return res;
    }
    // 2) a GTA VI-specific category matching the topic
    const found = await findCategories(topic);
    if (found.length) {
      const res = await listCategory(found[0], limit, cursor);
      return { ...res, otherMatchingCategories: found.slice(1) };
    }
    return { topic, found: false, hint: `No GTA VI category matches "${topic}". Try gta6_search.`, knownTopics: Object.keys(TOPICS) };
  }));

  server.registerPrompt("spoiler_free_help", {
    title: "Spoiler-free help",
    description: "Ask for help with GTA VI without story spoilers.",
    argsSchema: { question: z.string(), progress: z.string().optional().describe("Where you are, e.g. 'just finished the first heist'.") },
  }, ({ question, progress }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `I'm playing GTA VI${progress ? ` (progress: ${progress})` : ""}. ${question}\n\nUse the gta6_* tools and cite the wiki. ` +
          "Do not spoil anything beyond my progress; if an answer requires spoilers, warn me and ask first.",
      },
    }],
  }));

  server.registerResource("gta-wiki", "gta6://wiki", { title: "GTA Wiki", description: "Source wiki", mimeType: "text/plain" },
    async (uri) => ({ contents: [{ uri: uri.href, text: `${WIKI_BASE}/wiki/Grand_Theft_Auto_VI` }] }));

  return server;
}
