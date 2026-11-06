import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { VERSIONABLE_RESOURCE_TYPES } from "../types.js";
import { errorResult, guardWrite, jsonResult, PaginationShape, waitShape } from "./helpers.js";

const VersionableEnum = z.enum(VERSIONABLE_RESOURCE_TYPES);

export function registerVersionTools(server: McpServer, client: BookRhinoClient): void {
  // 1. list_versions
  server.tool(
    "list_versions",
    "List PaperTrail version history and field diffs for a versioned resource (books, characters, locations, or writing_styles).",
    {
      resource_type: VersionableEnum.describe("Versioned resource collection."),
      resource_id: z.number().int().positive().describe("ID of the book, character, location, or writing style."),
      ...PaginationShape,
    },
    async ({ resource_type, resource_id, ...params }) => {
      try {
        const res = await client.listVersions(resource_type, resource_id, params);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(
          `Failed to list versions for ${resource_type}/${resource_id}: ${err.message}`
        );
      }
    }
  );

  // 2. revert_version
  server.tool(
    "revert_version",
    "Revert a book, character, location, or writing_style back to the state captured in a specific PaperTrail version (note: initial creation versions cannot be reified).",
    {
      resource_type: VersionableEnum.describe("Versioned resource collection."),
      resource_id: z.number().int().positive().describe("Target resource ID."),
      version_id: z.number().int().positive().describe("PaperTrail version ID to restore."),
    },
    async ({ resource_type, resource_id, version_id }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const restored = await client.revertVersion(resource_type, resource_id, version_id);
        return jsonResult(restored);
      } catch (err: any) {
        return errorResult(
          `Failed to revert ${resource_type}/${resource_id} to version ${version_id}: ${err.message}`
        );
      }
    }
  );

  // 3. merge_version
  server.tool(
    "merge_version",
    "Synthesize and merge changes from a historical PaperTrail version into the current prompt/plot using AI (MergeBookPlotsJob / MergeCharacterPromptsJob / MergeLocationPromptsJob / MergeWritingStylesJob).",
    {
      resource_type: VersionableEnum.describe("Versioned resource collection."),
      resource_id: z.number().int().positive().describe("Target resource ID."),
      version_id: z.number().int().positive().describe("Historical PaperTrail version ID to merge with the current state."),
      ...waitShape(true),
    },
    async ({ resource_type, resource_id, version_id, wait, timeout_ms }) => {
      const blocked = guardWrite(client);
      if (blocked) return blocked;

      try {
        const res = await client.mergeVersion(resource_type, resource_id, version_id, {
          wait,
          timeoutMs: timeout_ms,
        });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(
          `Failed to merge version ${version_id} for ${resource_type}/${resource_id}: ${err.message}`
        );
      }
    }
  );
}
