import { z } from "zod";
import { BookRhinoClient } from "../client.js";

export type ToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function guardWrite(client: BookRhinoClient): ToolResult | null {
  if (client.config.readOnly) {
    return errorResult(
      "Operation rejected: Book Rhino MCP server is running in read-only mode (BOOK_RHINO_READ_ONLY=true)."
    );
  }
  return null;
}

export function guardAdmin(client: BookRhinoClient): ToolResult | null {
  const writeErr = guardWrite(client);
  if (writeErr) return writeErr;

  if (!client.config.allowAdmin) {
    return errorResult(
      "Operation rejected: Administrative mutations require BOOK_RHINO_ALLOW_ADMIN=true."
    );
  }
  return null;
}

export const PaginationShape = {
  page: z.number().int().positive().optional().describe("Page number (1-indexed, defaults to 1)."),
  per_page: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Items per page (1-100, defaults to 25)."),
};

export function waitShape(defaultWait: boolean) {
  return {
    wait: z
      .boolean()
      .optional()
      .describe(
        `Whether to poll Sidekiq until the operation completes (defaults to ${defaultWait}).`
      ),
    timeout_ms: z
      .number()
      .int()
      .positive()
      .max(600000)
      .optional()
      .describe("Maximum milliseconds to wait when wait=true before returning the in-progress operation."),
  };
}

export function validateDisjointBookCharacters(opts: {
  protagonist_id?: number | null;
  antagonist_ids?: number[];
  character_ids?: number[];
}): string | null {
  const { protagonist_id, antagonist_ids, character_ids } = opts;

  if (protagonist_id != null) {
    if (antagonist_ids?.includes(protagonist_id)) {
      return `Character ID ${protagonist_id} cannot be both protagonist_id and in antagonist_ids (roles must be mutually exclusive).`;
    }
    if (character_ids?.includes(protagonist_id)) {
      return `Character ID ${protagonist_id} cannot be both protagonist_id and in supporting character_ids (roles must be mutually exclusive).`;
    }
  }

  if (antagonist_ids && character_ids) {
    const antagonistSet = new Set(antagonist_ids);
    const overlap = character_ids.filter((id) => antagonistSet.has(id));
    if (overlap.length > 0) {
      return `Character ID(s) [${overlap.join(", ")}] cannot appear in both antagonist_ids and supporting character_ids (roles must be mutually exclusive).`;
    }
  }

  return null;
}
