import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BookRhinoClient } from "./client.js";
import { BookRhinoConfig } from "./config.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerBookTools } from "./tools/books.js";
import { registerChapterTools } from "./tools/chapters.js";
import { registerCharacterTools } from "./tools/characters.js";
import { registerImageTools } from "./tools/images.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerSceneTools } from "./tools/scenes.js";
import { registerSystemTools } from "./tools/system.js";
import { registerTaxonomyTools } from "./tools/taxonomies.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerWritingStyleTools } from "./tools/writing-styles.js";

export { prepareLocalImageUpload, writeManuscriptFile } from "./assets.js";
export { BookRhinoClient } from "./client.js";
export { parseConfig, type BookRhinoConfig } from "./config.js";
export * from "./types.js";

export function createBookRhinoMcpServer(config: BookRhinoConfig): McpServer {
  const client = new BookRhinoClient(config);

  const server = new McpServer({
    name: "book-rhino-mcp",
    version: "1.0.0",
  });

  registerSystemTools(server, client);
  registerBookTools(server, client);
  registerChapterTools(server, client);
  registerSceneTools(server, client);
  registerCharacterTools(server, client);
  registerLocationTools(server, client);
  registerWritingStyleTools(server, client);
  registerTaxonomyTools(server, client);
  registerVersionTools(server, client);
  registerImageTools(server, client);

  registerResources(server, client);
  registerPrompts(server, client);

  return server;
}
