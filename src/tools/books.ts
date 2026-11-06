import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeManuscriptFile } from "../assets.js";
import { BookRhinoClient } from "../client.js";
import {
  errorResult,
  guardWrite,
  jsonResult,
  PaginationShape,
  validateDisjointBookCharacters,
  waitShape,
} from "./helpers.js";

export function registerBookTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_books
  server.tool(
    "list_books",
    "List and search books in Book Rhino with filters for writing style, perspective, narrative structure, and AI pending/rendering state.",
    {
      q: z.string().optional().describe("Case-insensitive search across book title and plot."),
      writing_style_id: z.number().int().positive().optional().describe("Filter by WritingStyle ID."),
      perspective_id: z.number().int().positive().optional().describe("Filter by Perspective ID."),
      narrative_structure_id: z.number().int().positive().optional().describe("Filter by NarrativeStructure ID."),
      pending: z.boolean().optional().describe("Filter by pending AI plot generation/iteration status."),
      rendering: z.boolean().optional().describe("Filter by active manuscript rendering status."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listBooks(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list books: ${err.message}`);
      }
    }
  );

  // 2. get_book
  server.tool(
    "get_book",
    "Retrieve full details of a book including its taxonomies, protagonist, antagonists, supporting characters, locations, and ordered chapters/scenes.",
    {
      id: z.number().int().positive().describe("Book ID."),
    },
    async ({ id }) => {
      try {
        const book = await client.getBook(id);
        return jsonResult(book);
      } catch (err: any) {
        return errorResult(`Failed to get book ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_book
  server.tool(
    "create_book",
    "Create a new book. Requires title, writing_style_id, perspective_id, and narrative_structure_id. Note: protagonist_id, antagonist_ids, and supporting character_ids must be mutually exclusive.",
    {
      title: z.string().min(1).describe("Title of the book."),
      writing_style_id: z.number().int().positive().describe("Required WritingStyle ID."),
      perspective_id: z.number().int().positive().describe("Required Perspective ID."),
      narrative_structure_id: z.number().int().positive().describe("Required NarrativeStructure ID."),
      poetic_form_id: z.number().int().positive().optional().describe("Optional PoeticForm ID."),
      cinematic_style_id: z.number().int().positive().optional().describe("Optional CinematicStyle ID."),
      moral: z.string().optional().describe("Core theme, thesis, or moral of the story."),
      plot: z.string().optional().describe("Initial plot synopsis or seed notes (can also be synthesized via generate_book_plot)."),
      chapter_count: z.number().int().positive().optional().describe("Target number of chapters."),
      pages: z.number().int().positive().optional().describe("Target page count."),
      protagonist_id: z.number().int().positive().optional().describe("Primary protagonist Character ID (must not appear in antagonist_ids or character_ids)."),
      antagonist_ids: z.array(z.number().int().positive()).optional().describe("Antagonist Character IDs (must not overlap with protagonist_id or character_ids)."),
      character_ids: z.array(z.number().int().positive()).optional().describe("Supporting Character IDs (must not overlap with protagonist_id or antagonist_ids)."),
      location_ids: z.array(z.number().int().positive()).optional().describe("Location IDs featured in the book."),
    },
    async (args) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      const roleErr = validateDisjointBookCharacters(args);
      if (roleErr) return errorResult(roleErr);

      try {
        const book = await client.createBook(args);
        return jsonResult(book);
      } catch (err: any) {
        return errorResult(`Failed to create book: ${err.message}`);
      }
    }
  );

  // 4. update_book
  server.tool(
    "update_book",
    "Update an existing book's metadata, plot, taxonomy links, cast roles, or locations. Protagonist, antagonist, and supporting character IDs must remain mutually exclusive.",
    {
      id: z.number().int().positive().describe("Book ID to update."),
      title: z.string().min(1).optional().describe("Book title."),
      writing_style_id: z.number().int().positive().optional().describe("WritingStyle ID."),
      perspective_id: z.number().int().positive().optional().describe("Perspective ID."),
      narrative_structure_id: z.number().int().positive().optional().describe("NarrativeStructure ID."),
      poetic_form_id: z.number().int().positive().optional().describe("PoeticForm ID."),
      cinematic_style_id: z.number().int().positive().optional().describe("CinematicStyle ID."),
      moral: z.string().optional().describe("Core theme or moral."),
      plot: z.string().optional().describe("Plot text."),
      chapter_count: z.number().int().positive().optional().describe("Target chapter count."),
      pages: z.number().int().positive().optional().describe("Target page count."),
      protagonist_id: z.number().int().positive().optional().describe("Protagonist Character ID."),
      antagonist_ids: z.array(z.number().int().positive()).optional().describe("Antagonist Character IDs."),
      character_ids: z.array(z.number().int().positive()).optional().describe("Supporting Character IDs."),
      location_ids: z.array(z.number().int().positive()).optional().describe("Location IDs."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      const roleErr = validateDisjointBookCharacters(body);
      if (roleErr) return errorResult(roleErr);

      try {
        const book = await client.updateBook(id, body);
        return jsonResult(book);
      } catch (err: any) {
        return errorResult(`Failed to update book ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_book
  server.tool(
    "delete_book",
    "Permanently delete a book and all of its dependent chapters and scenes.",
    {
      id: z.number().int().positive().describe("Book ID to delete."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteBook(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete book ${id}: ${err.message}`);
      }
    }
  );

  // 6. get_book_manuscript
  server.tool(
    "get_book_manuscript",
    "Export or read the compiled Markdown manuscript for a book. Supports saving directly to a local file via output_path (returning word counts and a chapter table of contents without flooding context) and omits duplicate chapter JSON prose by default.",
    {
      id: z.number().int().positive().describe("Book ID."),
      output_path: z
        .string()
        .optional()
        .describe("Optional local file path (e.g. ./exports/my-book.md) to write the compiled Markdown directly to disk."),
      include_inline_markdown: z
        .boolean()
        .optional()
        .describe("Include full compiled Markdown in the tool response (defaults to true when output_path is omitted, false when output_path is provided)."),
      include_chapters_json: z
        .boolean()
        .optional()
        .describe("Include full chapters/scenes JSON objects alongside Markdown (defaults to false to avoid duplicating prose 2-3x in context)."),
    },
    async ({ id, output_path, include_inline_markdown, include_chapters_json }) => {
      try {
        const ms = await client.getBookManuscript(id);

        const toc = (ms.chapters || []).map((ch) => ({
          id: ch.id,
          number: ch.number,
          name: ch.name,
          word_count: ch.word_count,
          scenes_count: ch.scenes?.length ?? ch.scenes_count ?? 0,
          rendered: Boolean(ch.content && ch.content.trim().length > 0),
        }));

        let exportInfo: { saved_to: string; bytes_written: number } | undefined;
        if (output_path) {
          if (client.config.readOnly) {
            return errorResult(
              "Writing manuscript to local disk (output_path) is disabled when BOOK_RHINO_READ_ONLY=true."
            );
          }
          exportInfo = await writeManuscriptFile(output_path, ms.markdown || "");
        }

        const shouldIncludeMarkdown =
          include_inline_markdown ?? (output_path ? false : true);

        const payload: Record<string, unknown> = {
          id: ms.id,
          title: ms.title,
          total_chapters: ms.total_chapters,
          total_word_count: ms.total_word_count,
          ...(exportInfo ? exportInfo : {}),
          table_of_contents: toc,
        };

        if (shouldIncludeMarkdown) {
          payload.markdown = ms.markdown;
        }
        if (include_chapters_json) {
          payload.chapters = ms.chapters;
        }

        return jsonResult(payload);
      } catch (err: any) {
        return errorResult(`Failed to retrieve manuscript for book ${id}: ${err.message}`);
      }
    }
  );

  // 7. generate_book_plot
  server.tool(
    "generate_book_plot",
    "Enqueue AI plot and chapter-outline generation for a book (GenerateBookPlotJob). Tip: generate AI prompts on linked characters and locations first so their prompts are woven into the plot.",
    {
      id: z.number().int().positive().describe("Book ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.generateBookPlot(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to generate plot for book ${id}: ${err.message}`);
      }
    }
  );

  // 8. iterate_book_plot
  server.tool(
    "iterate_book_plot",
    "Refine an existing book plot and chapter outlines via AI feedback instructions (IterateOnBookPlotJob).",
    {
      id: z.number().int().positive().describe("Book ID."),
      message: z.string().min(1).describe("Editorial feedback or revision instructions for the plot."),
      ...waitShape(true),
    },
    async ({ id, message, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.iterateBookPlot(id, message, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to iterate plot for book ${id}: ${err.message}`);
      }
    }
  );

  // 9. render_book
  server.tool(
    "render_book",
    "Enqueue full-book prose rendering across all chapters sequentially (RenderBookJob). Defaults to wait=false because rendering an entire book can take several minutes; monitor via wait_for_operation or get_operation.",
    {
      id: z.number().int().positive().describe("Book ID."),
      ...waitShape(false),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.renderBook(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to start book rendering for book ${id}: ${err.message}`);
      }
    }
  );
}
