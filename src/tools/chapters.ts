import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

export function registerChapterTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_chapters
  server.tool(
    "list_chapters",
    "List chapters ordered by chapter number, typically filtered by book_id.",
    {
      book_id: z.number().int().positive().optional().describe("Filter chapters belonging to this Book ID."),
      rendering: z.boolean().optional().describe("Filter by active rendering status."),
      include_scenes: z.boolean().optional().describe("Include ordered scenes inside each chapter (defaults to false)."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listChapters(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list chapters: ${err.message}`);
      }
    }
  );

  // 2. get_chapter
  server.tool(
    "get_chapter",
    "Retrieve a single chapter by ID, including its outline, prose content, summary, word count, can_render status, and scenes.",
    {
      id: z.number().int().positive().describe("Chapter ID."),
      include_scenes: z.boolean().optional().describe("Include ordered scenes (defaults to true)."),
    },
    async ({ id, include_scenes }) => {
      try {
        const chapter = await client.getChapter(id, include_scenes ?? true);
        return jsonResult(chapter);
      } catch (err: any) {
        return errorResult(`Failed to get chapter ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_chapter
  server.tool(
    "create_chapter",
    "Create a new chapter for a book. Requires book_id, unique positive chapter number, name, and outline.",
    {
      book_id: z.number().int().positive().describe("Parent Book ID."),
      number: z.number().int().positive().describe("1-based chapter sequence number (unique per book)."),
      name: z.string().min(1).describe("Chapter title."),
      outline: z.string().min(1).describe("Detailed chapter beat sheet or outline."),
      summary: z.string().optional().describe("Chapter summary (defaults to empty string if omitted; ensure non-null if required by DB)."),
      content: z.string().optional().describe("Rendered prose content (optional)."),
      scene_count: z.number().int().positive().optional().describe("Target number of scenes for generate_chapter_scenes."),
    },
    async ({ book_id, summary, ...rest }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const chapter = await client.createChapter(book_id, {
          ...rest,
          summary: summary ?? "",
        });
        return jsonResult(chapter);
      } catch (err: any) {
        return errorResult(`Failed to create chapter in book ${book_id}: ${err.message}`);
      }
    }
  );

  // 4. update_chapter
  server.tool(
    "update_chapter",
    "Update a chapter's number, name, outline, prose content, summary, or target scene_count.",
    {
      id: z.number().int().positive().describe("Chapter ID."),
      number: z.number().int().positive().optional().describe("Chapter number."),
      name: z.string().min(1).optional().describe("Chapter title."),
      outline: z.string().optional().describe("Chapter outline."),
      content: z.string().optional().describe("Chapter prose content."),
      summary: z.string().optional().describe("Chapter summary."),
      scene_count: z.number().int().positive().optional().describe("Target scene count (> 0) for scene breakdown."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const chapter = await client.updateChapter(id, body);
        return jsonResult(chapter);
      } catch (err: any) {
        return errorResult(`Failed to update chapter ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_chapter
  server.tool(
    "delete_chapter",
    "Delete a chapter and all of its scenes.",
    {
      id: z.number().int().positive().describe("Chapter ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteChapter(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete chapter ${id}: ${err.message}`);
      }
    }
  );

  // 6. render_chapter
  server.tool(
    "render_chapter",
    "Render full prose content and summary for a chapter using AI (RenderChapterJob). Prerequisite: previous chapters in the book must already be rendered (can_render=true).",
    {
      id: z.number().int().positive().describe("Chapter ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.renderChapter(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to render chapter ${id}: ${err.message}`);
      }
    }
  );

  // 7. generate_chapter_scenes
  server.tool(
    "generate_chapter_scenes",
    "Break a rendered chapter down into structured scenes via AI (WriteScenesJob). Prerequisite: chapter must have rendered content AND scene_count > 0 (use update_chapter to set scene_count first if needed).",
    {
      id: z.number().int().positive().describe("Chapter ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.generateChapterScenes(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to generate scenes for chapter ${id}: ${err.message}`);
      }
    }
  );
}
