import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error("gta6-mcp running on stdio");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
