# GTA 6 Guide — MCP server for Grand Theft Auto VI

A Grand Theft Auto VI companion for Claude (Claude Desktop, Claude Code, or any [MCP](https://modelcontextprotocol.io) client). Ask things like:

> *"What's the fastest car in GTA 6 and where do I find it?"* · *"List every weapon."* · *"Who is Lucia? No spoilers please."* · *"How do I get to Port Gellhorn?"* · *"Is GTA 6 coming to PC?"*

Claude answers from the **live GTA Wiki** (always cited with a link) and a small set of **sourced official facts**, in your **controller's vocabulary** (PlayStation or Xbox), and **without story spoilers** unless you ask for them.

## Why a knowledge base and not a save reader?

GTA VI launched on **19 November 2026 for PlayStation 5 and Xbox Series X|S only**. There is no PC or Mac version yet (Rockstar has not announced one; a GamesBeat report points to early 2027), and console save files can't be read from a computer. So this server works from knowledge, not from your save: tell Claude where you are in the story and it tailors the help. `gta6_platform` explains this for your OS and console.

## Tools

| Tool | What it does |
| --- | --- |
| `gta6_overview` | Official facts (release, platforms, PC status, setting, protagonists, timeline, sources) + live wiki summary |
| `gta6_platform` | Your computer vs. the game's platforms, PC release status, and PlayStation/Xbox button names |
| `gta6_search` | Search the GTA Wiki; GTA VI pages are detected by category and ranked first |
| `gta6_page` | Read a page or one section; automatically picks the GTA VI article (e.g. "Lucia" → *Lucia Caminos*). Story-heavy pages/sections are **withheld unless `spoilers=true`**, and safe sections are suggested instead |
| `gta6_list` | List `missions`, `vehicles`, `characters`, `weapons`, `locations`, or any other topic (radio, businesses, animals…) matched to a GTA VI category, with pagination |

Plus a `spoiler_free_help` prompt.

## Install

### Claude Desktop (one click)

1. Download `gta6-mcp.mcpb` from the [latest release](https://github.com/adnan-kutay-yuksel/gta6-mcp/releases/latest).
2. Double-click it (or drag it into Claude Desktop → Settings → Extensions) and press **Install**.
3. Optional: enter your console (`ps5`, `ps5-pro`, `xbox-series-x`, `xbox-series-s`).

### Claude Code

```bash
claude mcp add gta6 -e GTA6_PLATFORM=ps5 -- npx -y github:adnan-kutay-yuksel/gta6-mcp
```

### Any MCP client

```json
{
  "mcpServers": {
    "gta6": {
      "command": "npx",
      "args": ["-y", "github:adnan-kutay-yuksel/gta6-mcp"],
      "env": { "GTA6_PLATFORM": "ps5" }
    }
  }
}
```

Requires Node.js 18+ and internet access (for the wiki). Responses are cached for 30 minutes.

## Sources & licensing

- Game details: [GTA Wiki](https://gta.fandom.com/wiki/Grand_Theft_Auto_VI) on Fandom, licensed CC BY-SA 3.0 — every result includes its source URL.
- Official facts: [rockstargames.com/VI](https://www.rockstargames.com/VI) and the Rockstar Newswire; the curated facts file is dated (`factsAsOf`) so Claude knows how fresh it is.

## Development

```bash
npm install
npm run typecheck
npm test              # offline unit tests (mocked wiki) + stdio MCP tests
LIVE=1 npm test       # also hit the real wiki
npm run build         # bundles to dist/index.js (committed so `npx github:` works)
npm run pack          # builds gta6-mcp.mcpb
```

When GTA VI comes to PC, a save/stats reader can be added next to the knowledge tools.

## Related

- [EU4 Save Advisor](https://github.com/adnan-kutay-yuksel/eu4-save-mcp)
- [EU5 Save Advisor](https://github.com/adnan-kutay-yuksel/eu5-save-mcp)

## License

MIT. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Grand Theft Auto is a trademark of Take-Two Interactive.
