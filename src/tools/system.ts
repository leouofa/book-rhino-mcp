import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BookRhinoClient } from "../client.js";
import { errorResult, guardAdmin, jsonResult, PaginationShape } from "./helpers.js";

export function registerSystemTools(server: McpServer, client: BookRhinoClient): void {
  // 1. check_health
  server.tool(
    "check_health",
    "Check connectivity and health status of the Book Rhino REST API v1.",
    {},
    async () => {
      try {
        const health = await client.getHealth();
        return jsonResult(health);
      } catch (err: any) {
        return errorResult(`Health check failed: ${err.message}`);
      }
    }
  );

  // 2. get_me
  server.tool(
    "get_me",
    "Retrieve the authenticated Book Rhino user profile, access status, and admin role.",
    {},
    async () => {
      try {
        const user = await client.getMe();
        return jsonResult(user);
      } catch (err: any) {
        return errorResult(`Failed to fetch user profile: ${err.message}`);
      }
    }
  );

  // 3. get_settings
  server.tool(
    "get_settings",
    "Retrieve global Book Rhino platform settings, LLM prompt templates, model tunings, and publish window status.",
    {},
    async () => {
      try {
        const settings = await client.getSettings();
        return jsonResult(settings);
      } catch (err: any) {
        return errorResult(`Failed to fetch platform settings: ${err.message}`);
      }
    }
  );

  // 4. update_settings
  server.tool(
    "update_settings",
    "Update global Book Rhino LLM prompts, tunings, image prompts, or publish window (requires admin user AND BOOK_RHINO_ALLOW_ADMIN=true).",
    {
      character_image_prompt: z.string().optional().describe("Global prompt template for character portrait generation."),
      character_pose_prompt: z.string().optional().describe("Global prompt template for character pose generation."),
      scene_background_prompt: z.string().optional().describe("Global prompt template for scene background generation."),
      location_background_prompt: z.string().optional().describe("Global prompt template for location background generation."),
      publish_start_time: z.string().optional().describe("ISO 8601 publish window start time."),
      publish_end_time: z.string().optional().describe("ISO 8601 publish window end time."),
      prompts: z.record(z.unknown()).optional().describe("System prompt overrides dictionary."),
      tunings: z.record(z.unknown()).optional().describe("LLM provider/model tuning parameters dictionary."),
    },
    async (args) => {
      const blocked = guardAdmin(client);
      if (blocked) return blocked;

      try {
        const updated = await client.updateSettings(args);
        return jsonResult(updated);
      } catch (err: any) {
        return errorResult(`Failed to update settings: ${err.message}`);
      }
    }
  );

  // 5. list_operations
  server.tool(
    "list_operations",
    "List asynchronous Sidekiq AI generation and rendering operations with optional status and resource filters.",
    {
      status: z
        .enum(["queued", "running", "succeeded", "failed"])
        .optional()
        .describe("Filter by operation execution status."),
      resource_type: z
        .string()
        .optional()
        .describe("Filter by polymorphic ActiveRecord class (e.g. Book, Chapter, Scene, Character, Location, WritingStyle)."),
      resource_id: z.number().int().positive().optional().describe("Filter by target resource ID."),
      operation_type: z
        .string()
        .optional()
        .describe("Filter by operation type (e.g. generate_prompt, iterate, merge_version, render_book, render_chapter, generate_scenes, render_scene)."),
      ...PaginationShape,
    },
    async (args) => {
      try {
        const res = await client.listOperations(args);
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Failed to list operations: ${err.message}`);
      }
    }
  );

  // 6. get_operation
  server.tool(
    "get_operation",
    "Inspect the current status, timestamps, metadata, and error details of a single Sidekiq operation.",
    {
      id: z.number().int().positive().describe("Operation ID."),
    },
    async ({ id }) => {
      try {
        const op = await client.getOperation(id);
        return jsonResult(op);
      } catch (err: any) {
        return errorResult(`Failed to get operation ${id}: ${err.message}`);
      }
    }
  );

  // 7. wait_for_operation
  server.tool(
    "wait_for_operation",
    "Poll an asynchronous Sidekiq operation until it succeeds, fails, or reaches timeout_ms, automatically returning the refreshed target resource.",
    {
      id: z.number().int().positive().describe("Operation ID to await."),
      timeout_ms: z
        .number()
        .int()
        .positive()
        .max(600000)
        .optional()
        .describe("Maximum wait duration in milliseconds (defaults to BOOK_RHINO_OPERATION_TIMEOUT_MS / 90000)."),
      fetch_resource: z
        .boolean()
        .optional()
        .describe("Whether to automatically fetch and include the updated resource once succeeded (defaults to true)."),
    },
    async ({ id, timeout_ms, fetch_resource }) => {
      try {
        const res = await client.waitForOperation(id, {
          timeoutMs: timeout_ms,
          fetchResource: fetch_resource ?? true,
        });
        return jsonResult(res);
      } catch (err: any) {
        return errorResult(`Operation ${id} failed: ${err.message}`);
      }
    }
  );
}
