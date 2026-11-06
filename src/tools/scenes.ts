import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

export function registerSceneTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_scenes
  server.tool(
    "list_scenes",
    "List scenes ordered by scene number, filtered by chapter_id or book_id.",
    {
      chapter_id: z.number().int().positive().optional().describe("Filter scenes in a specific Chapter ID."),
      book_id: z.number().int().positive().optional().describe("Filter scenes across all chapters of a Book ID."),
      rendering: z.boolean().optional().describe("Filter by active rendering status."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listScenes(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list scenes: ${err.message}`);
      }
    }
  );

  // 2. get_scene
  server.tool(
    "get_scene",
    "Retrieve a single scene by ID including its outline, rendered content, and summary.",
    {
      id: z.number().int().positive().describe("Scene ID."),
    },
    async ({ id }) => {
      try {
        const scene = await client.getScene(id);
        return jsonResult(scene);
      } catch (err: any) {
        return errorResult(`Failed to get scene ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_scene
  server.tool(
    "create_scene",
    "Create a new scene inside a chapter.",
    {
      chapter_id: z.number().int().positive().describe("Parent Chapter ID."),
      number: z.number().int().positive().describe("1-based scene number (unique within the chapter)."),
      outline: z.string().optional().describe("Scene beat/action outline."),
      content: z.string().optional().describe("Rendered scene content or script."),
      summary: z.string().optional().describe("Scene summary."),
    },
    async ({ chapter_id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const scene = await client.createScene(chapter_id, body);
        return jsonResult(scene);
      } catch (err: any) {
        return errorResult(`Failed to create scene in chapter ${chapter_id}: ${err.message}`);
      }
    }
  );

  // 4. update_scene
  server.tool(
    "update_scene",
    "Update a scene's number, outline, content, or summary.",
    {
      id: z.number().int().positive().describe("Scene ID."),
      number: z.number().int().positive().optional().describe("Scene sequence number."),
      outline: z.string().optional().describe("Scene outline."),
      content: z.string().optional().describe("Scene content."),
      summary: z.string().optional().describe("Scene summary."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const scene = await client.updateScene(id, body);
        return jsonResult(scene);
      } catch (err: any) {
        return errorResult(`Failed to update scene ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_scene
  server.tool(
    "delete_scene",
    "Delete a scene by ID.",
    {
      id: z.number().int().positive().describe("Scene ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteScene(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete scene ${id}: ${err.message}`);
      }
    }
  );

  // 6. render_scene
  server.tool(
    "render_scene",
    "Render detailed visual/prose content for a scene via AI (RenderSceneJob), with optional cinematic shot_type and style overrides.",
    {
      id: z.number().int().positive().describe("Scene ID."),
      shot_type: z
        .string()
        .optional()
        .describe("Optional camera/framing direction (e.g. wide establishing shot, close-up, over-the-shoulder)."),
      style: z
        .string()
        .optional()
        .describe("Optional visual or stylistic override for rendering this scene."),
      ...waitShape(true),
    },
    async ({ id, shot_type, style, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.renderScene(
          id,
          { shot_type, style },
          { wait, timeoutMs: timeout_ms }
        );
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to render scene ${id}: ${err.message}`);
      }
    }
  );
}
