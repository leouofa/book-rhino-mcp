import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookRhinoConfig } from "../src/config.js";
import { createBookRhinoMcpServer } from "../src/server.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function createConnectedTestPair(overrides: Partial<BookRhinoConfig> = {}) {
  const config: BookRhinoConfig = {
    originUrl: "http://localhost:3000",
    apiBaseUrl: "http://localhost:3000/api/v1",
    apiKey: "br_live_test",
    readOnly: false,
    allowAdmin: false,
    timeoutMs: 5000,
    operationTimeoutMs: 1000,
    pollIntervalMs: 10,
    ...overrides,
  };

  const server = createBookRhinoMcpServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const mcpClient = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

describe("BookRhinoMcpServer end-to-end", () => {
  let fetchSpy: any;
  let tmpDir: string;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "book-rhino-mcp-e2e-"));
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("registers all domain tools, resources, resource templates, and prompts", async () => {
    const client = await createConnectedTestPair();

    const toolsRes = await client.listTools();
    const toolNames = toolsRes.tools.map((t) => t.name);

    expect(toolNames).toContain("check_health");
    expect(toolNames).toContain("get_me");
    expect(toolNames).toContain("wait_for_operation");
    expect(toolNames).toContain("create_book");
    expect(toolNames).toContain("get_book_manuscript");
    expect(toolNames).toContain("generate_book_plot");
    expect(toolNames).toContain("render_chapter");
    expect(toolNames).toContain("generate_chapter_scenes");
    expect(toolNames).toContain("render_scene");
    expect(toolNames).toContain("create_character");
    expect(toolNames).toContain("create_location");
    expect(toolNames).toContain("create_writing_style");
    expect(toolNames).toContain("list_all_taxonomies");
    expect(toolNames).toContain("create_taxonomy_item");
    expect(toolNames).toContain("list_versions");
    expect(toolNames).toContain("merge_version");
    expect(toolNames).toContain("attach_image");
    // Ensure api_tokens management is intentionally excluded
    expect(toolNames.some((n) => n.includes("api_token"))).toBe(false);
    expect(toolNames.length).toBe(74);

    const resourcesRes = await client.listResources();
    const uris = resourcesRes.resources.map((r) => r.uri);
    expect(uris).toContain("bookrhino://taxonomies");
    expect(uris).toContain("bookrhino://books");

    const templatesRes = await client.listResourceTemplates();
    const templateUris = templatesRes.resourceTemplates.map((t) => t.uriTemplate);
    expect(templateUris).toContain("bookrhino://books/{id}");
    expect(templateUris).toContain("bookrhino://books/{id}/manuscript");
    expect(templateUris).toContain("bookrhino://characters/{id}");
    expect(templateUris).toContain("bookrhino://locations/{id}");

    const promptsRes = await client.listPrompts();
    const promptNames = promptsRes.prompts.map((p) => p.name);
    expect(promptNames).toEqual([
      "architect_book",
      "develop_character",
      "produce_chapter",
      "craft_writing_style",
    ]);
  });

  it("enforces BOOK_RHINO_READ_ONLY and BOOK_RHINO_ALLOW_ADMIN guardrails", async () => {
    const roClient = await createConnectedTestPair({ readOnly: true });

    const createBlocked: any = await roClient.callTool({
      name: "create_region",
      arguments: { name: "Outer Rim" },
    });
    expect(createBlocked.isError).toBe(true);
    expect(createBlocked.content[0].text).toContain("BOOK_RHINO_READ_ONLY=true");
    expect(fetchSpy).not.toHaveBeenCalled();

    // Standard read-write client without allowAdmin blocks update_settings
    const normalClient = await createConnectedTestPair({ readOnly: false, allowAdmin: false });
    const adminBlocked: any = await normalClient.callTool({
      name: "update_settings",
      arguments: { character_image_prompt: "8k portrait" },
    });
    expect(adminBlocked.isError).toBe(true);
    expect(adminBlocked.content[0].text).toContain("BOOK_RHINO_ALLOW_ADMIN=true");

    // Admin-enabled client allows update_settings
    const adminClient = await createConnectedTestPair({ readOnly: false, allowAdmin: true });
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: { id: 1, character_image_prompt: "8k portrait", within_publish_window: true },
      })
    );
    const adminAllowed: any = await adminClient.callTool({
      name: "update_settings",
      arguments: { character_image_prompt: "8k portrait" },
    });
    expect(adminAllowed.isError).toBeFalsy();
    expect(JSON.parse(adminAllowed.content[0].text).character_image_prompt).toBe("8k portrait");
  });

  it("validates mutually exclusive character roles on create_book before network call", async () => {
    const client = await createConnectedTestPair();

    const overlapRes: any = await client.callTool({
      name: "create_book",
      arguments: {
        title: "Glass Horizon",
        writing_style_id: 1,
        perspective_id: 1,
        narrative_structure_id: 1,
        protagonist_id: 10,
        character_ids: [10, 12],
      },
    });

    expect(overlapRes.isError).toBe(true);
    expect(overlapRes.content[0].text).toContain("cannot be both protagonist_id and in supporting character_ids");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("trims duplicate prose and supports local output_path export on get_book_manuscript", async () => {
    const client = await createConnectedTestPair();

    const manuscriptPayload = {
      data: {
        id: 4,
        title: "Chronicles of Dust",
        total_chapters: 1,
        total_word_count: 120,
        markdown: "# Chronicles of Dust\n\n## Chapter 1: Dawn\n\nRed sand drifted across the glass.",
        chapters: [
          {
            id: 41,
            book_id: 4,
            number: 1,
            name: "Dawn",
            content: "Red sand drifted across the glass.",
            word_count: 120,
            rendering: false,
            can_render: true,
            scenes: [],
          },
        ],
      },
    };

    // Inline mode omits chapters JSON by default
    fetchSpy.mockResolvedValueOnce(jsonResponse(manuscriptPayload));
    const inlineRes: any = await client.callTool({
      name: "get_book_manuscript",
      arguments: { id: 4 },
    });
    expect(inlineRes.isError).toBeFalsy();
    const inlineJson = JSON.parse(inlineRes.content[0].text);
    expect(inlineJson.markdown).toContain("# Chronicles of Dust");
    expect(inlineJson.chapters).toBeUndefined();
    expect(inlineJson.table_of_contents).toHaveLength(1);

    // File export mode writes to disk and omits inline markdown unless requested
    fetchSpy.mockResolvedValueOnce(jsonResponse(manuscriptPayload));
    const targetFile = path.join(tmpDir, "chronicles.md");
    const exportRes: any = await client.callTool({
      name: "get_book_manuscript",
      arguments: { id: 4, output_path: targetFile },
    });
    expect(exportRes.isError).toBeFalsy();
    const exportJson = JSON.parse(exportRes.content[0].text);
    expect(exportJson.saved_to).toBe(targetFile);
    expect(exportJson.markdown).toBeUndefined();
    expect(await fs.readFile(targetFile, "utf8")).toContain("Red sand drifted across the glass.");
  });

  it("uploads local image files via attach_image and serves resources & prompts", async () => {
    const client = await createConnectedTestPair();

    const pngPath = path.join(tmpDir, "portrait.png");
    await fs.writeFile(
      pngPath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      )
    );

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            id: 77,
            title: "Concept Portrait",
            character_id: 9,
            image: {
              url: "/rails/active_storage/blobs/portrait.png",
              filename: "portrait.png",
              content_type: "image/png",
              byte_size: 68,
            },
          },
        },
        201
      )
    );

    const imgRes: any = await client.callTool({
      name: "attach_image",
      arguments: {
        owner_type: "character",
        owner_id: 9,
        title: "Concept Portrait",
        file_path: pngPath,
      },
    });
    expect(imgRes.isError).toBeFalsy();
    const imgJson = JSON.parse(imgRes.content[0].text);
    expect(imgJson.image.url).toBe("http://localhost:3000/rails/active_storage/blobs/portrait.png");

    // Read bookrhino://books/4/manuscript resource
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 4,
          title: "Chronicles",
          total_chapters: 1,
          total_word_count: 5,
          markdown: "# Chronicles\n\nHello world.",
          chapters: [],
        },
      })
    );
    const resourceRes = await client.readResource({ uri: "bookrhino://books/4/manuscript" });
    expect(resourceRes.contents[0].mimeType).toBe("text/markdown");
    expect(resourceRes.contents[0].text).toBe("# Chronicles\n\nHello world.");

    // Execute produce_chapter prompt
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 4,
          title: "Chronicles",
          writing_style_id: 1,
          pending: false,
          rendering: false,
          chapters: [
            {
              id: 101,
              book_id: 4,
              number: 1,
              name: "Act I",
              can_render: true,
              rendering: false,
              word_count: 0,
              scene_count: 3,
              scenes: [],
            },
          ],
        },
      })
    );
    const promptRes = await client.getPrompt({
      name: "produce_chapter",
      arguments: { book_id: "4", chapter_number: "1", scene_count: "3" },
    });
    expect(promptRes.messages).toHaveLength(1);
    expect((promptRes.messages[0].content as any).text).toContain("Sequential Rendering Prerequisite");
    expect((promptRes.messages[0].content as any).text).toContain("Act I");
  });
});
