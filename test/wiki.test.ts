import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getPage, listCategory, parseInfobox, resolveTitle, search, setFetcher, wikitextToPlain, findCategories } from "../src/wiki.ts";
import { platformReport } from "../src/platform.ts";

/** Fake MediaWiki API keyed on a few query parameters. */
function fakeWiki(routes: (p: URLSearchParams) => unknown) {
  const calls: string[] = [];
  setFetcher(async (url) => {
    const p = new URL(url).searchParams;
    calls.push(url);
    const r = routes(p);
    if (r === undefined) throw new Error(`unexpected request ${url}`);
    return r;
  });
  return calls;
}

const LUCIA_WIKITEXT = `{{Infobox character|name = Lucia Caminos|voice = [[Manni L. Perez]]|home = [[Vice City]]}}
'''Lucia Caminos''' is a protagonist.
==History==
Secret twist here.
==Ending==
She does something.
==Appearance==
Tattoos.`;

beforeEach(() => fakeWiki(() => undefined));

test("wikitext to plain text", () => {
  const t = wikitextToPlain(`'''Bold''' [[Vice City|VC]] {{Ref|x}} <ref>a</ref> [[File:x.png]] [https://x.y Link]\n\n\n\nEnd`);
  assert.equal(t, "Bold VC Link\n\nEnd");
});

test("infobox parsing handles nested links/templates", () => {
  const ib = parseInfobox(LUCIA_WIKITEXT);
  assert.deepEqual(ib, { name: "Lucia Caminos", voice: "Manni L. Perez", home: "Vice City" });
});

test("resolveTitle prefers the GTA VI article", async () => {
  fakeWiki((p) => {
    if (p.get("titles")) return { query: { pages: [{ title: "Lucia (GTA VI)", missing: true }, { title: "Lucia (Grand Theft Auto VI)", missing: true }, { title: "Lucia (HD Universe)", missing: true }, { title: "Lucia Caminos" }], redirects: [{ from: "Lucia", to: "Lucia Caminos" }] } };
  });
  assert.equal(await resolveTitle("Lucia"), "Lucia Caminos");
});

test("spoiler-heavy pages are withheld unless spoilers=true", async () => {
  fakeWiki((p) => {
    if (p.get("titles")) return { query: { pages: [{ title: "Lucia Caminos (GTA VI)" }] } };
    if (p.get("action") === "parse" && !p.get("section"))
      return { parse: { title: "Lucia Caminos (GTA VI)", wikitext: LUCIA_WIKITEXT, categories: [{ category: "Characters_in_GTA_VI" }], sections: [{ index: "1", line: "History", level: "2" }, { index: "2", line: "Ending", level: "2" }, { index: "3", line: "Appearance", level: "2" }] } };
    if (p.get("section") === "3") return { parse: { wikitext: "==Appearance==\nTattoos." } };
    if (p.get("section") === "2") return { parse: { wikitext: "==Ending==\nShe does something." } };
  });
  const safe = await getPage("Lucia Caminos");
  assert.equal(safe.spoilerRisk, "high");
  assert.equal(safe.text, "");
  assert.deepEqual(safe.safeSections, ["Appearance"]);
  assert.match(safe.textWithheld!, /spoilers=true/);
  assert.equal(safe.infobox?.voice, "Manni L. Perez");
  const sec = await getPage("Lucia Caminos", { section: "appearance" });
  assert.match(sec.text, /Tattoos/);
  const blocked = await getPage("Lucia Caminos", { section: "Ending" });
  assert.equal(blocked.text, "");
  const full = await getPage("Lucia Caminos", { spoilers: true });
  assert.match(full.text, /Secret twist/);
});

test("search marks GTA VI hits by category and ranks them first", async () => {
  fakeWiki((p) => {
    if (p.get("list") === "search") return { query: { search: [{ title: "Infernus", snippet: "a car" }, { title: "Pegassi Zentorno (HD)", snippet: "" }] } };
    if (p.get("prop") === "categories") return { query: { pages: [{ title: "Pegassi Zentorno (HD)", categories: [{ title: "Category:Vehicles in GTA VI" }] }, { title: "Infernus", categories: [{ title: "Category:Vehicles in GTA V" }] }] } };
  });
  const hits = await search("fast car", 5);
  assert.equal(hits[0].title, "Pegassi Zentorno (HD)");
  assert.equal(hits[0].gta6, true);
  assert.equal(hits[1].gta6, false);
});

test("category listing and discovery", async () => {
  fakeWiki((p) => {
    if (p.get("list") === "categorymembers") return { query: { categorymembers: [{ title: "Gear Up", ns: 0 }, { title: "Category:Story missions in GTA VI", ns: 14 }] }, continue: { cmcontinue: "abc" } };
    if (p.get("list") === "search") return { query: { search: [{ title: "Category:Radio Stations in GTA VI" }, { title: "Category:Radio Stations" }] } };
  });
  const l = await listCategory("Missions in GTA VI");
  assert.deepEqual(l.pages, ["Gear Up"]);
  assert.deepEqual(l.subcategories, ["Story missions in GTA VI"]);
  assert.equal(l.next, "abc");
  assert.deepEqual(await findCategories("radio"), ["Radio Stations in GTA VI"]);
});

test("platform report adapts to console", () => {
  const ps = platformReport("ps5");
  assert.equal((ps.controllerVocabulary as any).faceBottom, "Cross (✕)");
  const xb = platformReport("xbox-series-s");
  assert.equal((xb.controllerVocabulary as any).rightTrigger, "RT");
  assert.match(ps.gameOnThisComputer, /Not available/);
});
