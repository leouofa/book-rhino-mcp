import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BookRhinoClient } from "./client.js";

function parseNumericUriParam(param: string | string[], label: string): number {
  const raw = Array.isArray(param) ? param[0] : param;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric ${label} in resource URI: "${raw}"`);
  }
  return parsed;
}

export function registerResources(server: McpServer, client: BookRhinoClient): void {
  // 1. Unified taxonomies & writing styles snapshot
  server.resource(
    "taxonomies",
    "bookrhino://taxonomies",
    {
      description:
        "Live dictionary of all 8 Book Rhino creative taxonomies plus writing_styles for resolving IDs prior to creating books or characters.",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = await client.fetchAllTaxonomiesAndStyles();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(snapshot, null, 2),
          },
        ],
      };
    }
  );

  // 2. Books catalog
  server.resource(
    "books",
    "bookrhino://books",
    {
      description: "Paginated catalog of Book Rhino books with current generation and rendering states.",
      mimeType: "application/json",
    },
    async (uri) => {
      const books = await client.listBooks({ per_page: 50 });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(books, null, 2),
          },
        ],
      };
    }
  );

  // 3. Detailed book by ID
  server.resource(
    "book-by-id",
    new ResourceTemplate("bookrhino://books/{id}", { list: undefined }),
    {
      description:
        "Complete book record including linked taxonomies, cast roles, locations, and ordered chapters/scenes.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const bookId = parseNumericUriParam(id, "book id");
      const book = await client.getBook(bookId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(book, null, 2),
          },
        ],
      };
    }
  );

  // 4. Compiled Markdown manuscript by book ID
  server.resource(
    "book-manuscript",
    new ResourceTemplate("bookrhino://books/{id}/manuscript", { list: undefined }),
    {
      description: "Full compiled Markdown manuscript of a Book Rhino book.",
      mimeType: "text/markdown",
    },
    async (uri, { id }) => {
      const bookId = parseNumericUriParam(id, "book id");
      const manuscript = await client.getBookManuscript(bookId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: manuscript.markdown || "",
          },
        ],
      };
    }
  );

  // 5. Character sheet by ID
  server.resource(
    "character-by-id",
    new ResourceTemplate("bookrhino://characters/{id}", { list: undefined }),
    {
      description:
        "Detailed character profile including biographical traits, taxonomies, AI prompt, and resolved portrait image URLs.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const charId = parseNumericUriParam(id, "character id");
      const character = await client.getCharacter(charId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(character, null, 2),
          },
        ],
      };
    }
  );

  // 6. Location profile by ID
  server.resource(
    "location-by-id",
    new ResourceTemplate("bookrhino://locations/{id}", { list: undefined }),
    {
      description:
        "Detailed location profile including sensory atmosphere, parent region, AI prompt, and resolved image URLs.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const locId = parseNumericUriParam(id, "location id");
      const location = await client.getLocation(locId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(location, null, 2),
          },
        ],
      };
    }
  );
}
