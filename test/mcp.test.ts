import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let client: Client;

before(async () => {
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, "..", "dist", "index.js")], env: { ...process.env, GTA6_PLATFORM: "ps5" } as Record<string, string> }));
});
after(async () => { await client?.close(); });

const call = async (name: string, args: Record<string, unknown> = {}) =>
  JSON.parse(((await client.callTool({ name, arguments: args })) as { content: { text: string }[] }).content[0].text);

test("tools and prompts are registered", async () => {
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["gta6_list", "gta6_overview", "gta6_page", "gta6_platform", "gta6_search"]);
  assert.equal((await client.listPrompts()).prompts[0].name, "spoiler_free_help");
});

test("platform tool uses GTA6_PLATFORM", async () => {
  const r = await call("gta6_platform");
  assert.equal(r.playerConsole, "ps5");
  assert.equal(r.controllerVocabulary.leftTrigger, "L2");
});

// Live checks against gta.fandom.com — run with LIVE=1 npm test
test("live wiki", { skip: !process.env.LIVE }, async () => {
  const ov = await call("gta6_overview");
  assert.match(ov.liveFromWiki.summary, /Grand Theft Auto VI/);
  const list = await call("gta6_list", { topic: "vehicles", limit: 5 });
  assert.equal(list.pages.length, 5);
  const page = await call("gta6_page", { title: "Lucia" });
  assert.equal(page.title, "Lucia Caminos");
  assert.ok(page.textWithheld);
});
