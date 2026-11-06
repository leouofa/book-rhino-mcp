import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

export function registerWritingStyleTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_writing_styles
  server.tool(
    "list_writing_styles",
    "List writing styles with their parsed JSON style prompts and attached sample text counts.",
    {
      q: z.string().optional().describe("Case-insensitive search by writing style name."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listWritingStyles(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list writing styles: ${err.message}`);
      }
    }
  );

  // 2. get_writing_style
  server.tool(
    "get_writing_style",
    "Retrieve a single writing style by ID, optionally including its attached prose corpus sample texts.",
    {
      id: z.number().int().positive().describe("WritingStyle ID."),
      include_texts: z
        .boolean()
        .optional()
        .describe("Include full sample corpus texts attached to this writing style (defaults to false)."),
    },
    async ({ id, include_texts }) => {
      try {
        const ws = await client.getWritingStyle(id, include_texts ?? false);
        return jsonResult(ws);
      } catch (err: any) {
        return errorResult(`Failed to get writing style ${id}: ${err.message}`);
      }
    }
  );

  // 3. create_writing_style
  server.tool(
    "create_writing_style",
    "Create a new writing style. You can attach sample prose excerpts via create_text and then synthesize the style prompt via generate_writing_style_prompt, or provide a JSON prompt object directly.",
    {
      name: z.string().min(1).describe("Writing style name (required)."),
      prompt: z
        .union([z.record(z.unknown()), z.string()])
        .optional()
        .describe("Optional structured JSON object (or JSON string) defining tone, diction, syntax, and pacing."),
    },
    async (args) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const ws = await client.createWritingStyle(args);
        return jsonResult(ws);
      } catch (err: any) {
        return errorResult(`Failed to create writing style: ${err.message}`);
      }
    }
  );

  // 4. update_writing_style
  server.tool(
    "update_writing_style",
    "Update an existing writing style's name or JSON prompt.",
    {
      id: z.number().int().positive().describe("WritingStyle ID."),
      name: z.string().min(1).optional().describe("Writing style name."),
      prompt: z
        .union([z.record(z.unknown()), z.string()])
        .optional()
        .describe("Structured JSON style prompt object (or JSON string)."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const ws = await client.updateWritingStyle(id, body);
        return jsonResult(ws);
      } catch (err: any) {
        return errorResult(`Failed to update writing style ${id}: ${err.message}`);
      }
    }
  );

  // 5. delete_writing_style
  server.tool(
    "delete_writing_style",
    "Delete a writing style and its attached sample texts.",
    {
      id: z.number().int().positive().describe("WritingStyle ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteWritingStyle(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete writing style ${id}: ${err.message}`);
      }
    }
  );

  // 6. generate_writing_style_prompt
  server.tool(
    "generate_writing_style_prompt",
    "Analyze the writing style's attached sample texts and synthesize a structured JSON style prompt via AI (GenerateWritingStyleJob).",
    {
      id: z.number().int().positive().describe("WritingStyle ID."),
      ...waitShape(true),
    },
    async ({ id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.generateWritingStylePrompt(id, { wait, timeoutMs: timeout_ms });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to generate prompt for writing style ${id}: ${err.message}`);
      }
    }
  );

  // 7. iterate_writing_style_prompt
  server.tool(
    "iterate_writing_style_prompt",
    "Refine a writing style's JSON prompt via AI instructions (IterateOnWritingStyleJob).",
    {
      id: z.number().int().positive().describe("WritingStyle ID."),
      message: z.string().min(1).describe("Editorial instructions for adjusting the writing style prompt."),
      ...waitShape(true),
    },
    async ({ id, message, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.iterateWritingStylePrompt(id, message, {
          wait,
          timeoutMs: timeout_ms,
        });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to iterate prompt for writing style ${id}: ${err.message}`);
      }
    }
  );

  // 8. list_texts
  server.tool(
    "list_texts",
    "List reference prose corpus texts used to train/analyze writing styles.",
    {
      writing_style_id: z.number().int().positive().optional().describe("Filter by parent WritingStyle ID."),
      q: z.string().optional().describe("Search by text sample name."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listTexts(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list texts: ${err.message}`);
      }
    }
  );

  // 9. get_text
  server.tool(
    "get_text",
    "Retrieve a single reference prose corpus text by ID.",
    {
      id: z.number().int().positive().describe("Text ID."),
    },
    async ({ id }) => {
      try {
        const text = await client.getText(id);
        return jsonResult(text);
      } catch (err: any) {
        return errorResult(`Failed to get text ${id}: ${err.message}`);
      }
    }
  );

  // 10. create_text
  server.tool(
    "create_text",
    "Attach a sample prose excerpt/corpus text to a writing style for style analysis.",
    {
      writing_style_id: z.number().int().positive().describe("Parent WritingStyle ID."),
      name: z.string().min(1).describe("Title/label of the sample excerpt."),
      corpus: z.string().min(1).describe("Prose excerpt text to analyze."),
    },
    async ({ writing_style_id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const text = await client.createText(writing_style_id, body);
        return jsonResult(text);
      } catch (err: any) {
        return errorResult(`Failed to create text for writing style ${writing_style_id}: ${err.message}`);
      }
    }
  );

  // 11. update_text
  server.tool(
    "update_text",
    "Update a reference sample text's name or prose corpus.",
    {
      id: z.number().int().positive().describe("Text ID."),
      name: z.string().min(1).optional().describe("Sample excerpt label."),
      corpus: z.string().optional().describe("Prose corpus content."),
      writing_style_id: z.number().int().positive().optional().describe("WritingStyle ID."),
    },
    async ({ id, ...body }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const text = await client.updateText(id, body);
        return jsonResult(text);
      } catch (err: any) {
        return errorResult(`Failed to update text ${id}: ${err.message}`);
      }
    }
  );

  // 12. delete_text
  server.tool(
    "delete_text",
    "Delete a reference sample text by ID.",
    {
      id: z.number().int().positive().describe("Text ID."),
    },
    async ({ id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.deleteText(id);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to delete text ${id}: ${err.message}`);
      }
    }
  );
}
